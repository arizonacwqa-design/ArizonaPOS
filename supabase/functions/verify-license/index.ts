export const config = { auth: false };

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface LicenseRow {
  id: string;
  license_key: string;
  is_active: boolean;
  machine_id: string | null;
  activated_at: string | null;
}

interface RequestBody {
  license_key: string;
  machine_id: string;
}

interface ResponseBody {
  valid: boolean;
  message: string;
}

function json(body: ResponseBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ valid: false, message: "Only POST allowed" }, 405);
  }

  try {
    const { license_key, machine_id }: RequestBody = await req.json();

    if (!license_key || !machine_id) {
      return json({ valid: false, message: "license_key and machine_id are required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const headers = {
      "apikey": supabaseServiceRoleKey,
      "Authorization": `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    };

    const query = `${supabaseUrl}/rest/v1/licenses?license_key=eq.${encodeURIComponent(license_key)}&select=*`;
    const res = await fetch(query, { headers });

    if (!res.ok) {
      throw new Error(`Database query failed: ${res.statusText}`);
    }

    const rows: LicenseRow[] = await res.json();

    if (rows.length === 0) {
      return json({ valid: false, message: "License key not found" });
    }

    const license = rows[0];

    if (!license.is_active) {
      return json({ valid: false, message: "License is not active" });
    }

    if (license.machine_id === null) {
      const updateUrl = `${supabaseUrl}/rest/v1/licenses?id=eq.${license.id}`;
      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          machine_id,
          activated_at: new Date().toISOString(),
        }),
      });

      if (!updateRes.ok) {
        throw new Error(`Failed to bind machine: ${updateRes.statusText}`);
      }

      return json({ valid: true, message: "License activated on this machine" });
    }

    if (license.machine_id === machine_id) {
      return json({ valid: true, message: "License is valid" });
    }

    return json({ valid: false, message: "License already activated on another machine" });
  } catch (err) {
    return json({ valid: false, message: `Server error: ${err.message}` }, 500);
  }
});
