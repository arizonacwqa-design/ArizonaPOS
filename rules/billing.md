# Strict Billing System Rules

> **Authority**: This file defines **enforced rules** for the Arizona Car World POS billing system.
> Every rule below is either already enforced in code or explicitly gapped with a status label.
> Violating these rules = system integrity failure.
>
> Must be read alongside `rules/inventory.md` — stock deduction rules are interdependent with billing.

---

## Rule 1 — Invoice Total Must Be Mathematically Correct

**Status**: ✅ ENFORCED

- Total is computed by `calcBillingTotals()` in `src/lib/pos.js:112-135`
- Formula is `subtotal → discount → afterDiscount → tax → total`
- Each intermediate value is rounded to 2 decimals via `Math.round(v * 100) / 100`
- Stored in DB as `sales.subtotal`, `sales.discount`, `sales.tax_amount`, `sales.total_amount`
- No recalculation happens on print — invoice displays stored values
- PDF generation reads same stored values (no drift)

**Enforcement chain**: POS UI → `calcBillingTotals()` → `create_sale()` RPC → DB columns

---

## Rule 2 — Discounts Cannot Exceed Allowed Limits

**Status**: ✅ ENFORCED

| Constraint | Cap | Behavior |
|-----------|-----|----------|
| Flat discount (QAR) | Subtotal (capped) | `discountCapped` flag + warning shown |
| Percentage discount | 100% of input, capped at subtotal | Warning: "Discount capped at subtotal" |
| Discount type toggle | Flat or %, not both | Radio-style toggle in UI |

**Enforcement**: `calcBillingTotals()` at `src/lib/pos.js:119-120`:
```js
const disc = Math.min(rawDiscount, base);
const discountCapped = rawDiscount > base && base > 0;
```

**Edge case (fixed)**: Clearing the discount input previously set it to `""` (not `0`). Fixed in `POS.jsx:598` — cleared input now sets `0`.

---

## Rule 3 — Taxes Must Be Applied After Discount

**Status**: ✅ ENFORCED

**Order**: `subtotal − discount = afterDiscount` → `tax = afterDiscount × (rate / 100)`

**Enforcement**: `calcBillingTotals()` at `src/lib/pos.js:122-123`:
```js
const afterDiscount = Math.max(0, base - disc);
const taxAmount = Math.round(afterDiscount * (rate / 100) * 100) / 100;
```

This is **hardcoded** — no configuration can change the order without modifying source code.

**Tax toggling**:
- Tax is optional (checkbox in UI)
- Rate is 0-100%, step 0.5
- Default rate from `VITE_DEFAULT_TAX_RATE` env var (default 0)
- When disabled → `tax_amount = 0` in DB

---

## Rule 4 — Stock Must Reduce Only After Successful Invoice

**Status**: ✅ ENFORCED

- Stock deduction happens **inside** the `create_sale()` Postgres RPC
- The RPC is a single transaction: sale INSERT → items INSERT → trigger deduction
- If any step fails (including stock shortfall), **everything rolls back**
- Stock is deducted by `on_sale_item_inventory` trigger using row-level lock (`SELECT ... FOR UPDATE`)

**Proof**: `supabase/migrations/006_pos_security_atomicity.sql:114-197`
```
create_sale(jsonb, jsonb) → BEGIN → INSERT sale → INSERT items → COMMIT/ROLLBACK
```

**Fallback**: If migration 006 is NOT applied, the old per-item trigger still fires AFTER INSERT. Stock would still deduct, but without the atomic guarantee. The UI shows an error telling admin to run migration.

---

## Rule 5 — Failed Payment Must Roll Back Stock Change

**Status**: ✅ ENFORCED (within atomic transaction) / ⚠️ PARTIAL (no external payment gateway)

**Current behavior**:
- The system has **no external payment gateway** — payment is informational (cash/card/bank_transfer/other)
- "Failed payment" in this context = any error during `create_sale()` RPC execution
- RPC errors (stock shortfall, DB constraint, RLS rejection) → **full rollback**, no stock change
- Client-side errors (network timeout after RPC succeeds) → sale IS created, stock IS deducted

**Network timeout edge case**:
1. RPC succeeds on server (sale created + stock deducted)
2. Client receives network error before reading response
3. User sees error message, but sale already exists
4. **No auto-rollback possible** — staff must check Reports to verify

**Recommendation**: Add a "pending/reconcile" status or query RPC result on reconnection.

---

## Rule 6 — No Manual Override Without Log Entry

**Status**: ⚠️ PARTIALLY ENFORCED

**Current state**:
- There is **no override mechanism** in the UI
- If stock is insufficient, the transaction is blocked — no force-complete option
- Discount caps are automated, not overridable
- **Refund system** (Migration 012) provides audit trail: `refund_log` table records who refunded, when, why, and amount

**Gaps**:
- Admin can directly modify DB via Supabase dashboard (no audit trail)
- No log of who changed what or why for non-refund edits
- No reason-required dialog for discounts > X%
- No supervisor approval workflow
- No `stock_movements` audit table

**Future requirement**:
- Any manual inventory adjustment must record: `actor_id`, `reason`, `timestamp`, `delta`
- Any discount above configurable threshold must require reason

---

## Rule 7 — Every Invoice Must Have a Unique ID

**Status**: ✅ ENFORCED

- Invoice number format: `INV-{N}` where N comes from `invoice_number_seq` (starts at 1001)
- Generated by DB `DEFAULT` on `sales.invoice_number`: `'INV-' || nextval('invoice_number_seq')`
- `UNIQUE` constraint on `sales.invoice_number` column
- Sequence is monotonically increasing — no gaps from rollbacks (Postgres sequences don't roll back)

**Guarantees**:
- Two concurrent sales always get different invoice numbers
- No manual assignment possible (auto-generated)
- Deleting a sale does NOT reuse its invoice number

---

## Validation Checklist

### Before Invoice Creation

Each check below **must pass** before `create_sale()` RPC is called.

| # | Check | Enforced In | What It Validates |
|---|-------|-------------|-------------------|
| 1 | **Customer name** | `POS.jsx:160-163` | Not empty, max 100 chars |
| 2 | **Cart not empty** | `POS.jsx:168-171` | At least 1 line item |
| 3 | **Stock availability** | `pos.js:83-99` | `validateCartStock()` — each item's needed ≤ current_stock |
| 4 | **Unit price integrity** | `pos.js:2-25` | `cartLineFromService()` — price from DB, not user input |
| 5 | **Line total correct** | `pos.js:4,17` | `unit_price × quantity`, rounded to 2 decimals |
| 6 | **Subtotal correct** | `POS.jsx:95` | Sum of all `line_total` values |
| 7 | **Discount ≤ subtotal** | `pos.js:119` | Capped automatically, flag reported |
| 8 | **Tax rate 0-100** | `pos.js:122` | `Math.min(100, Math.max(0, rate))` |
| 9 | **Tax on discounted amount** | `pos.js:122-123` | `afterDiscount × (rate / 100)` |
| 10 | **Total = subtotal − discount + tax** | `pos.js:124` | Final rounding to 2 decimals |
| 11 | **Payment method valid** | DB CHECK | One of: cash, card, bank_transfer, other |
| 12 | **Employee authorized** | RLS policy | Employee can only create own sales |

### After Invoice Creation

Each check below **must pass** after `create_sale()` returns.

| # | Check | How It's Verified | What It Ensures |
|---|-------|-------------------|-----------------|
| A | **Stock deducted** | Trigger `on_sale_item_inventory` | `current_stock -= inventory_deducted` (with row lock) |
| B | **Stock ≥ 0** | CHECK constraint | `current_stock >= 0` on `inventory_items` |
| C | **Invoice number assigned** | `create_sale()` returns sale object | `sale.invoice_number` is defined and unique |
| D | **Sale logged in DB** | `create_sale()` returns sale + items | Both `sales` and `sale_items` rows exist |
| E | **Customer updated** | Inside `create_sale()` RPC (Migration 010) | `customers` table upserted atomically with sale |
| F | **Response verified** | `POS.jsx:238-243` | RPC result contains `sale` and `items` objects |
| G | **Cart cleared** | `POS.jsx:253-254` | `setCart([])`, `setCustomer(emptyCustomer)` |
| H | **Memory update** | This file | After any billing logic change, update `rules/billing.md` and `.memory/changelog.md` |

---

## Enforcement Summary

| Rule | Code Enforcement | DB Enforcement | Gaps |
|------|-----------------|----------------|------|
| 1. Math correct | `calcBillingTotals()` | Stored values | None |
| 2. Discount limits | `Math.min(rawDiscount, base)` | None needed | Resolved — cleared input sets `0` |
| 3. Tax after discount | `afterDiscount × rate` | None needed | Order hardcoded |
| 4. Stock after sale | RPC creates then trigger deducts | CHECK + FK | Old trigger (without migration 006) lacks atomicity |
| 5. Rollback on fail | RPC wraps in transaction | ROLLBACK on any error | Network timeout edge case |
| 6. No override w/o log | No override UI exists | `refund_log` table for refunds | Admin can edit DB directly; no `stock_movements` table |
| 7. Unique invoice | Auto-sequence | UNIQUE constraint | None |

---

## Source Reference

| Component | File | Line(s) |
|-----------|------|---------|
| Billing math | `src/lib/pos.js` | 112-135 |
| Cart line building | `src/lib/pos.js` | 2-45 |
| Stock validation | `src/lib/pos.js` | 83-99 |
| POS page | `src/pages/POS.jsx` | 158-260 |
| Atomic sale RPC | `supabase/migrations/006_pos_security_atomicity.sql` | 114-197 |
| Stock deduction trigger | `supabase/schema.sql` | 226-242 |
| Constants | `src/lib/constants.js` | 1-43 |
