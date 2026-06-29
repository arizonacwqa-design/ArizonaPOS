# Strict License Verification Rules

> **Authority**: This file defines **enforced rules** for the Arizona Car World POS license
> activation and verification system. Every rule below is either enforced in code or explicitly
> gapped with a status label.

---

## Rule 1 — App Must Not Render Without Valid License

**Status**: ✅ ENFORCED

- `LicenseGate` component in `src/components/LicenseGate.jsx` wraps entire app in `src/main.jsx`
- Three states: `loading` (spinner), `entry` (activation form), `verified` (render children)
- Until `state === 'verified'`, **no app content renders** (no router, no auth, no pages)
- Entry screen is full-screen black & gold, matching the ArizonaPOS luxury theme

**Enforcement chain**: `main.jsx` → `<LicenseGate>` → `LicenseGate.jsx`

---

## Rule 2 — License Must Be Verified Against Supabase Edge Function

**Status**: ✅ ENFORCED

- On activation: POST `{ license_key, machine_id }` to `VITE_LICENSE_VERIFY_URL`
- On reload (keys in localStorage): same POST to verify still valid
- Background reverify: every 86400000ms (24h) via `setInterval`
- Edge Function URL: `https://vdjhwmdzbjztiqhyrmai.supabase.co/functions/v1/verify-license`
- Deployed with `--no-verify-jwt` (public, no JWT required)

**Edge Function logic** (`supabase/functions/verify-license/index.ts`):
```
1. Query licenses WHERE license_key = key
2. Not found  → { valid: false, "License key not found" }
3. !is_active  → { valid: false, "License is not active" }
4. machine_id IS NULL → bind it, set activated_at → { valid: true, "activated" }
5. machine_id matches → { valid: true, "License is valid" }
6. machine_id differs → { valid: false, "already activated on another machine" }
```

---

## Rule 3 — Machine Identity Must Be Stable

**Status**: ✅ ENFORCED

- `machine_id` is generated once via `crypto.randomUUID()` on first activation
- Stored in `localStorage` key `acw_machine_id`
- Never regenerated — persists across app restarts
- If user clears browser data → new machine_id generated → must re-activate

---

## Rule 4 — License Gate Fails Open When Server Is Unreachable

**Status**: ✅ ENFORCED

- If the Edge Function is unreachable (network error, timeout):
  - During initial activation → shows `"Could not reach license server"` error
  - During startup verification → **fails open** (app renders, no error)
  - During 24h background check → **silent fail** (no user disruption)
- Rationale: network issues should not block the POS from working

---

## Rule 5 — Invalid/Deactivated License Clears Keys Immediately

**Status**: ✅ ENFORCED

- On startup check: if `data.valid === false` → `localStorage.removeItem()` for **both** keys → `setState('entry')` with error
- On 24h check: if `data.valid === false` → same cleanup → entry screen shows on next user interaction
- Both keys are always removed together (atomic in practice — sequential `removeItem` calls)

---

## Rule 6 — license_key and machine_id Are Stored in localStorage

**Status**: ✅ ENFORCED

| Key | Value | Set when |
|-----|-------|----------|
| `acw_license_key` | The license key string | On successful activation |
| `acw_machine_id` | UUID v4 string | On first activation (never changes) |

Both keys are read on every app launch. If either is missing → entry screen.

---

## Rule 7 — Edge Function Uses Service Role Key (Server-Side Only)

**Status**: ✅ ENFORCED

- The Edge Function reads `SUPABASE_SERVICE_ROLE_KEY` from Deno env (set automatically by Supabase)
- Never exposed to the client — the function is the intermediary
- The client (browser) calls the function URL directly (no anon key needed since `--no-verify-jwt`)
- RLS on `licenses` table restricts direct SELECT/INSERT/UPDATE to authenticated users with admin role

---

## Rule 8 — Seed License Keys for Testing

**Status**: ⚠️ MANUAL (inserted via SQL)

| License Key | Status | Bound To |
|-------------|--------|----------|
| `ACW-2025-MAIN-001` | Active | None (unbound) |

Insert via Supabase SQL Editor or:
```sql
INSERT INTO public.licenses (license_key, is_active)
VALUES ('ACW-2025-MAIN-001', true)
ON CONFLICT (license_key) DO NOTHING;
```
