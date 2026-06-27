# Failure Response Protocol

> **Standard Operating Procedure** for diagnosing and fixing POS system failures.
> Follow this exactly when any issue is reported or detected.

---

## Failure Response Flow

```
Issue reported/detected
       │
       ▼
┌──────────────────┐
│  1. Read logs    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  2. Identify     │
│     root cause   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  3. Classify     │
│     issue type   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  4. Suggest fix  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  5. Ask approval │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  6. Apply fix    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  7. Validate     │
│     system       │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  8. Update memory with lesson│
└──────────────────────────────┘
```

---

## Step 1 — Read Logs

### Available Log Sources

| Source | Location | What It Contains |
|--------|----------|-----------------|
| Supabase Dashboard | `https://supabase.com → Logs` | DB errors, RLS rejections, auth failures |
| Browser Console | F12 → Console | Client-side errors, failed RPC calls, network errors |
| Browser Network tab | F12 → Network | API response codes, request payloads, timing |
| Electron Console | Run with `--dev` flags | Native print errors, file I/O issues |
| Application state | Zustand DevTools | Auth state, cart state at time of failure |

### Log Reading Checklist

- [ ] Check browser console for uncaught exceptions
- [ ] Check network tab for failed Supabase requests (4xx/5xx)
- [ ] Check Supabase logs for DB query errors
- [ ] Check if error is reproducible (same steps, different browser)
- [ ] Check if error affects all users or specific user/role

---

## Step 2 — Identify Root Cause

### Common Root Cause Patterns

| Symptom | Likely Root Cause | Where to Look |
|---------|------------------|---------------|
| "create_sale not found" | Migration 006 not applied | Browser console → PGRST202 error |
| "Insufficient stock for X" | Race condition or low stock | `sale_items.inventory_deducted` vs `inventory_items.current_stock` |
| Blank screen on login | Missing `.env` or invalid Supabase URL | Browser console → network 400 on auth call |
| "No profile found" | Trigger `handle_new_user()` not fired | Auth.users table vs profiles table |
| Invoice not printing | Electron API not available | `window.electronAPI` undefined |
| Wrong totals on invoice | `calcBillingTotals()` bug | Compare UI values vs stored DB values |
| Cart not clearing | React state bug | Zustand devtools — cart array still populated |
| Customer not saving | `customers` table missing (migration 005) | Console warning: "customers table is missing" |

### Root Cause Classification

```
Is it a data problem?    → Check DB values vs expected values
Is it a code problem?    → Check recent commits or logic changes
Is it a config problem?  → Check .env, wrangler.jsonc, Supabase settings
Is it an infrastructure problem? → Check Supabase status, Cloudflare, network
```

---

## Step 3 — Classify Issue

### Issue Types

| Type | Label | Examples |
|------|-------|----------|
| 🧮 **Billing error** | `billing_error` | Wrong total, discount miscalc, tax wrong, invoice number duplicate |
| 📦 **Inventory mismatch** | `inventory_mismatch` | Stock not deducted, wrong amount deducted, stock out of sync |
| 🗄️ **Database error** | `database_error` | Constraint violation, RLS rejection, missing migration, FK error |
| 🔗 **Integration failure** | `integration_failure` | Webhook timeout, n8n down, WhatsApp link broken, print API failed |
| ⚛️ **UI/State error** | `ui_state_error` | Cart not clearing, wrong role shown, page crash, infinite loading |

### Classification Decision Tree

```
Does the error involve money amounts?
  YES → billing_error
  NO → Does the error involve stock levels?
    YES → inventory_mismatch
    NO → Does the error come from Supabase?
      YES → database_error
      NO → Does the error involve external service?
        YES → integration_failure
        NO → ui_state_error
```

---

## Step 4 — Suggest Fix

### Fix Template

```
Issue: <classification>: <brief description>
Root Cause: <what was actually wrong>
Fix: <exact changes needed>
Risk: <low / medium / high>
Test: <how to verify fix works>
```

### Example Fixes by Type

| Issue Type | Common Fix | Risk |
|-----------|-----------|------|
| billing_error | Adjust `calcBillingTotals()` or stored values | Medium — affects revenue |
| inventory_mismatch | Run reconciliation query or reverse/redo trigger | High — stock correctness |
| database_error | Apply missing migration or fix RLS policy | Low — idempotent SQL |
| integration_failure | Update webhook URL or add retry logic | Low — additive change |
| ui_state_error | Fix React state reset logic | Low — UI only |

---

## Step 5 — Ask Approval

Before applying any fix, present:

```
═══════════════════════════════════════════
  FIX PROPOSAL
═══════════════════════════════════════════

Issue: [classification] [description]
Root Cause: [one-line summary]
Fix: [what will change]
Files affected: [list]
Risk: [low/medium/high]
Financial impact: [none/revenue/cost change]
Inventory impact: [none/stock change]
Rollback: [how to undo]

→ Approve fix? (yes/no)
```

Wait for explicit approval before executing Step 6.

---

## Step 6 — Apply Fix

### Fix Application Rules

1. **Never modify production DB directly** — always use a migration file
2. **Never edit `schema.sql` directly** — use numbered migrations
3. **Back up affected data** before running data-fixing queries
4. **Test on staging** if available, or document why not
5. **One change at a time** — apply, verify, then apply next

### Fix Application Order

```
1. Read current state of affected files
2. Create migration file (if DB change) or edit source code
3. Apply change
4. Run validation (Step 7)
5. If validation fails → rollback and return to Step 4
```

---

## Step 7 — Validate System

### Validation Checklist

After applying fix, verify:

- [ ] **Original error no longer reproducible** — follow same steps that triggered it
- [ ] **Billing still accurate** — create a test sale, verify totals match `calcBillingTotals()`
- [ ] **Inventory still in sync** — check stock levels before and after test sale
- [ ] **No new console errors** — browser console is clean
- [ ] **All users unaffected** — test with both admin and employee roles
- [ ] **Migration applied cleanly** (if DB change) — `supabase migration list` or manual check

### Validation Commands (Manual)

```sql
-- Check stock never negative
SELECT id, name, current_stock FROM inventory_items WHERE current_stock < 0;

-- Check invoice total consistency
SELECT id, invoice_number, subtotal, discount, tax_amount, total_amount,
  (subtotal - discount + tax_amount = total_amount) AS math_ok
FROM sales
WHERE math_ok = false;

-- Check sale items total vs sale total
SELECT s.id, s.invoice_number, s.total_amount, SUM(si.line_total) AS items_total
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
GROUP BY s.id, s.invoice_number, s.total_amount
HAVING s.total_amount != SUM(si.line_total);
```

---

## Step 8 — Update Memory with Lesson

After the fix is validated, record the lesson learned:

### Lesson Log Entry Template

```
## Lesson YYYY-MM-DD: [Issue Title]

**Classification**: [billing_error | inventory_mismatch | database_error | integration_failure | ui_state_error]

**Symptoms**: What the user or system observed.

**Root Cause**: Why it happened (one paragraph).

**Fix Applied**: What was changed and in which files.

**Prevention**: How to prevent this in the future.
- Code change: [description]
- Process change: [description]
- Monitoring: [description]

**Related Files**: [list of files modified]

**Related Memory Updates**: [list of .memory/ files updated]
```

### Add to:

1. `known-issues.md` — if this is a new known issue
2. `changelog.md` — log the fix
3. `todo.md` — if preventive work remains
4. This file (`failure-response.md`) — add to lessons learned section

---

## Escalation Protocol (Repeated Issue)

If the **same issue repeats** after a fix:

```
1. Root cause analysis (formal):
   - When did it first occur?
   - When was the fix applied?
   - When did it recur?
   - What changed between fix and recurrence?
   - Was the fix incomplete? Was it reverted? Was there a new trigger?

2. Architectural improvement proposal:
   - Is the root cause a design flaw?
   - Can we prevent this class of error entirely?
   - Suggested change: <description>
   - Risk: <assessment>
   - Migration needed: <yes/no>
```

### Examples of Architectural Improvements for Repeated Issues

| Repeated Issue | Architectural Fix |
|----------------|-------------------|
| Stock out of sync | Replace triggers with materialized ledger + reconciliation job |
| Missing migrations | Automated migration runner on app startup |
| RLS policy gaps | Policy audit script + CI check on migration PRs |
| Network timeout edge case | Idempotency keys + reconcile dashboard |

---

## Lessons Learned

_This section grows with each resolved incident._

| Date | Issue | Classification | Root Cause | Prevention |
|------|-------|---------------|------------|------------|
| — | — | — | — | — |
