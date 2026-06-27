# Strict Inventory Management Rules

> **Authority**: This file defines **enforced rules** for all inventory operations in the
> Arizona Car World POS system. Every rule below is either enforced in code or explicitly
> gapped. Must be read alongside `rules/billing.md` — the two systems are interdependent.

---

## Rule 1 — Stock Cannot Go Below Zero Unless Explicitly Allowed

**Status**: ✅ ENFORCED

- DB constraint: `CHECK (current_stock >= 0)` on `inventory_items` table
- Trigger-level protection: `apply_sale_inventory_deduction()` validates `available >= inventory_deducted` before deducting, then `RAISE EXCEPTION` on shortfall — entire transaction rolls back
- Client-level protection: `validateCartStock()` in `src/lib/pos.js:83-99` blocks sale submission if any item's needed > current_stock
- No mechanism to "explicitly allow" negative stock exists in code

**Enforcement chain** (3 layers):
```
Client validateCartStock() → DB trigger FOR UPDATE + check → CHECK constraint
```

**Enforcement**: `supabase/migrations/006_pos_security_atomicity.sql:36-40`:
```sql
IF available < NEW.inventory_deducted THEN
  RAISE EXCEPTION 'Insufficient stock for %: have %, need %',
    item_name, available, NEW.inventory_deducted;
END IF;
```

**Consistency with billing (`rules/billing.md` Rule 4)**: Stock deduction happens only inside the `create_sale()` atomic RPC. If billing fails, stock never changes. Both systems agree — stock cannot go negative.

---

## Rule 2 — Every Stock Change Must Be Logged

**Status**: ⚠️ NOT ENFORCED

**Current state**:
- Stock changes happen via DB triggers (`on_inventory_purchase`, `on_sale_item_inventory`)
- These triggers modify `inventory_items.current_stock` directly
- **No audit/history table exists** that records what changed, by how much, by whom, and why
- Sales and purchases are logged in their respective tables (`sales`, `sale_items`, `inventory_purchases`), so a stock change can be reconstructed by joining these tables, but there is no single stock_movements log

**What exists today**:
| Operation | Table that records it | Can derive stock change? |
|-----------|----------------------|--------------------------|
| Sale | `sale_items.inventory_deducted` | Yes, per item |
| Purchase | `inventory_purchases.{quantity_added,meters_added}` | Yes, per item |
| Refund | `refund_log` | Yes, per refund |
| Direct DB edit | None | No |

**Gap**: Admin editing stock directly via Supabase dashboard leaves zero trace. No `stock_movements` table exists.

**Future requirement**:
```
stock_movements {
  id: UUID PK
  item_id: UUID FK → inventory_items
  delta: NUMERIC       -- positive = addition, negative = removal
  reason: TEXT         -- 'sale', 'purchase', 'refund', 'manual_adjustment'
  reference_id: UUID   -- sale_id, purchase_id, or NULL for manual
  actor_id: UUID FK → profiles
  created_at: TIMESTAMPTZ
}
```

---

## Rule 3 — Purchase Adds Stock

**Status**: ✅ ENFORCED

**Mechanism**: DB trigger `on_inventory_purchase` → `apply_inventory_purchase()` in `supabase/schema.sql:153-179`:

```sql
UPDATE inventory_items
SET current_stock = current_stock + add_amount, updated_at = NOW()
WHERE id = NEW.inventory_item_id;
```

Where `add_amount` = `meters_added` for meter items, `quantity_added` for quantity items.

**Enforcement chain**: Purchase form → `supabase.from('inventory_purchases').insert(payload)` → `AFTER INSERT` trigger → stock increment

**Validation**:
- Purchase form validates `inventory_item_id`, `supplier_name`, and quantity > 0
- Bill number uniqueness checked client-side (`Purchases.jsx:110-121`)
- Total cost computed: `unit_cost × quantity_added` (auto by trigger if not provided)

**Consistency with billing**: This is the only way stock increases. No other path adds stock. The billing system only deducts stock (see `rules/billing.md` Rule 4).

---

## Rule 4 — Sale Reduces Stock

**Status**: ✅ ENFORCED

**Mechanism**: DB trigger `on_sale_item_inventory` → `apply_sale_inventory_deduction()` in `supabase/migrations/006_pos_security_atomicity.sql:19-49`:

```sql
SELECT current_stock INTO available FROM inventory_items WHERE id = NEW.inventory_item_id FOR UPDATE;
IF available < NEW.inventory_deducted THEN RAISE EXCEPTION ... END IF;
UPDATE inventory_items SET current_stock = current_stock - NEW.inventory_deducted WHERE id = NEW.inventory_item_id;
```

**Two deduction paths**:

| Path | Trigger | Price Impact |
|------|---------|-------------|
| Service-linked inventory (`inventory_item_id` + `consumption_per_unit > 0`) | Automatic on service selection | Revenue-generating (service price) |
| Direct material usage (added via `InventoryUsageSection`) | Manual staff choice | Non-revenue (`line_total = 0`) |

**Reservation**: `FOR UPDATE` row lock prevents two concurrent POS terminals from overselling the same item.

**Consistency with billing (`rules/billing.md` Rule 4 + 5)**: Stock deduction is atomic with invoice creation. The `create_sale()` RPC wraps both in one transaction. If the sale fails, stock is never deducted.

---

## Rule 5 — Refund Restores Stock

**Status**: ✅ ENFORCED (Migration 012)

**Implementation**:
- `reverse_stock_for_sale(p_sale_id)` — restores inventory deducted by sale items
- Called by `process_refund()` RPC — admin-only, inside a single transaction
- UI: Reports → ReprintModal → "Refund This Invoice" button (admin only)
- Audit: `refund_log` table records every refund with reason and processor
- Reports: Refunds tab shows full log; daily/monthly totals exclude refunded sales

**Consistency with billing**: Refund system updates both inventory (stock restored) and billing (sale marked as refunded, excluded from revenue). Both change atomically.

---

## Safeguards

### Safeguard 1 — Detect Negative Stock Attempts

**Status**: ✅ ENFORCED (2 layers)

| Layer | Location | Behavior |
|-------|----------|----------|
| Client-side validation | `pos.js:83-99` — `validateCartStock()` | Blocks submission, shows: "Item X: need Y unit, only Z in stock" |
| Server-side lock + check | `006_pos_security_atomicity.sql:36-40` | `RAISE EXCEPTION`, entire transaction rolls back |

**Edge case**: If both layers fail (e.g., custom script hitting API), the `CHECK (current_stock >= 0)` constraint on the table is the final stop.

### Safeguard 2 — Warn Before Stock Depletion

**Status**: ✅ ENFORCED

**POS — pre-sale warning**:
- `InventoryUsageSection` shows stock availability per item
- `aggregateInventoryUsage()` computes total deduction for each item
- Amber warning box lists all items that will be deducted with quantities
- If any item would drop below 0, `validateCartStock()` blocks entirely

**Purchase form — current stock display**:
- When selecting an item, shows `Current Stock: Xm` or `X pcs`
- Helps admin gauge whether purchase is needed

### Safeguard 3 — Generate Low-Stock Alerts

**Status**: ✅ ENFORCED

**Trigger**: `isLowStock(item)` = `current_stock <= low_stock_threshold`

| Location | What It Shows |
|----------|---------------|
| Dashboard | `LowStockBanner` dismissible banner + alert cards with item count |
| Dashboard | Red-highlighted inventory table rows for low stock items |
| Inventory page | "Low Stock" filter + red "Low" status badge per row |
| Reports | Dedicated "Low Stock" tab with full list |

**Threshold**: Default = 5 (configurable per item via `low_stock_threshold` column)

**Gap**: No proactive notification (email/WhatsApp) when stock drops below threshold. Alerts are only visible when a user is logged into the dashboard.

---

## Stock Operations Summary

| Operation | Direction | Code Entry Point | DB Trigger | Gap |
|-----------|-----------|-----------------|------------|-----|
| Purchase (Stock IN) | + | `src/pages/Purchases.jsx` | `apply_inventory_purchase()` | None |
| Sale (Stock OUT) | − | `src/pages/POS.jsx` → `create_sale()` RPC | `apply_sale_inventory_deduction()` | None |
| Material usage (Stock OUT) | − | `src/pages/POS.jsx` → `create_sale()` RPC | `apply_sale_inventory_deduction()` | None |
| Refund (Stock IN) | + | Reports → ReprintModal | `reverse_stock_for_sale()` inside `process_refund()` RPC | None |
| Manual adjustment | ± | **No UI** | **No trigger** | ❌ Missing + no audit |

---

## Stock Types Reference

| Type | Category Examples | Unit | Min | Step | DB Column Used |
|------|-------------------|------|-----|------|----------------|
| meter | PPF, Tint | m | 0.1 | 0.5 | `meters_added` |
| quantity | Shampoo, Polish, Chemicals, Supplies, Bottles | pcs | 1 | 1 | `quantity_added` |

---

## Consistency Cross-Check with Billing System

| Billing Rule (`rules/billing.md`) | Inventory Rule | Consistent? |
|-----------------------------------|---------------|-------------|
| R4: Stock reduces only after successful invoice | R4: Sale reduces stock | ✅ — Same atomic transaction |
| R5: Failed payment rolls back stock | R1: Stock cannot go below zero | ✅ — Rollback prevents negative |
| R6: No manual override without log | R2: Every stock change must be logged | ⚠️ — Both have same audit gap |
| Billing validation step 3: Stock check | Safeguard 1: Detect negative attempts | ✅ — Same `validateCartStock()` |
| Billing validation step B: Stock ≥ 0 | R1: CHECK constraint | ✅ — Same DB constraint |

---

## Source Reference

| Component | File | Line(s) |
|-----------|------|---------|
| Sale deduction trigger (new) | `supabase/migrations/006_pos_security_atomicity.sql` | 19-49 |
| Sale deduction trigger (old) | `supabase/schema.sql` | 226-242 |
| Purchase addition trigger | `supabase/schema.sql` | 153-179 |
| Client stock validation | `src/lib/pos.js` | 83-99 |
| Low stock check | `src/lib/format.js` | 21-26 |
| Inventory page | `src/pages/Inventory.jsx` | 1-295 |
| Purchases page | `src/pages/Purchases.jsx` | 1-375 |
| Low stock threshold config | `inventory_items.low_stock_threshold` column | — |
| Stock non-negative constraint | `inventory_items` table CHECK | — |
