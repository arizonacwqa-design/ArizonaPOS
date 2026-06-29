export const config = { auth: false };

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, message: "Only POST allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { license_key, machine_id }: RequestBody = await req.json();

    if (!license_key || !machine_id) {
      return new Response(JSON.stringify({ valid: false, message: "license_key and machine_id are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
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
      const body: ResponseBody = { valid: false, message: "License key not found" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const license = rows[0];

    if (!license.is_active) {
      const body: ResponseBody = { valid: false, message: "License is not active" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
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

      const body: ResponseBody = { valid: true, message: "License activated on this machine" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (license.machine_id === machine_id) {
      const body: ResponseBody = { valid: true, message: "License is valid" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: ResponseBody = { valid: false, message: "License already activated on another machine" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const body: ResponseBody = { valid: false, message: `Server error: ${err.message}` };
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
