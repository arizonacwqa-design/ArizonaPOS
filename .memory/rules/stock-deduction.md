# Stock Deduction Rules

> See also the **strict enforcement version** at `rules/inventory.md` (project root) which
> documents which rules are enforced in code vs. which are gaps. This `.memory` file covers
> operational detail; the strict file covers enforcement status.

## Source
- DB trigger: `supabase/schema.sql` → `apply_sale_inventory_deduction()`
- Updated trigger: `supabase/migrations/006_pos_security_atomicity.sql` (row-locking version)
- Purchase trigger: `supabase/schema.sql` → `apply_inventory_purchase()`
- Client validation: `src/lib/pos.js` → `validateCartStock()`
- UI: `src/pages/POS.jsx` → `InventoryUsageSection`

## Deduction Paths

### Path 1: Service-Linked Inventory
When a service has:
- `inventory_item_id` → references an inventory item
- `consumption_per_unit > 0` → how much stock is used per quantity sold

Formula:
```
inventory_deducted = consumption_per_unit × quantity
```
Example: PPF service with consumption_per_unit = 2, sold qty 3 → deducts 6 meters.

### Path 2: Direct Material Usage
When staff adds inventory items directly to cart (non-revenue):
- Deducts the entered quantity directly
- `line_total = 0` (materials are not billed)
- Used for consumables used during service not linked to a specific service

## Validation (Client-Side)
Before sale submission, `validateCartStock()` in `src/lib/pos.js`:
1. Aggregates all inventory needed from cart
2. Compares against `current_stock` from loaded catalog
3. If any item has insufficient stock → error message shown, sale blocked

## Validation (Server-Side — Atomic)
The `on_sale_item_inventory` Postgres trigger:
1. Locks the inventory row (`SELECT ... FOR UPDATE`)
2. Checks `available >= inventory_deducted`
3. If insufficient → RAISE EXCEPTION (entire transaction rolls back)
4. If sufficient → `UPDATE current_stock = current_stock - deducted`

## Stock Addition (Purchases)
When a purchase is recorded:
1. `on_inventory_purchase` trigger fires AFTER INSERT
2. `apply_inventory_purchase()` function:
   - Checks item's `stock_type`
   - If 'meter' → uses `meters_added`
   - If 'quantity' → uses `quantity_added`
   - `UPDATE current_stock = current_stock + added_amount`

## Stock Types
| Type | Unit | Min Deduction | Increment |
|------|------|--------------|-----------|
| meter | m | 0.1 | 0.5 |
| quantity | pcs | 1 | 1 |

## Constraint
- `CHECK (current_stock >= 0)` on `inventory_items` table
- Prevents negative stock even if trigger fails

## Low Stock Threshold
- `isLowStock(item)` = `current_stock <= low_stock_threshold`
- Default threshold = 5 (configurable per item)
- Alerts on Dashboard, Inventory page, Reports

## Refund Reversal
- `reverse_stock_for_sale(p_sale_id)` restores inventory deducted by a sale's items
- Called by `process_refund()` RPC inside the same transaction
- Stock is returned to `current_stock` without affecting purchase records

## Impacts
- **Business**: Ensures stock accuracy across multiple POS terminals. Prevents overselling.
- **Financial**: Stock value directly affects expense reporting and profit calculation.
- **Inventory**: Every sale, purchase, and refund changes stock levels. Mutations are atomic.
