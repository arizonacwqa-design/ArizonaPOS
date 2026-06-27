# Inventory Management

## Stock Types
The system supports two stock types:

| Type | Description | Examples | Unit | Increment |
|------|-------------|----------|------|-----------|
| **meter** | Continuous rolls measured in meters | PPF Clear Gloss, PPF Matte, Tint 5%, Tint 35% | `m` | 0.5 |
| **quantity** | Discrete countable items | Car Shampoo, Polish Compound, Microfiber Towels | `pcs` | 1 |

## Inventory Items Table
- `name` — item name
- `category` — PPF, Tint, Shampoo, Polish, Detergents, Bottles, Lighters, Chemicals, Supplies
- `stock_type` — 'meter' | 'quantity'
- `current_stock` — current available stock (numeric, >= 0 via CHECK constraint)
- `low_stock_threshold` — alert threshold
- `unit_label` — display unit (default 'pcs')
- `barcode` — optional barcode for scanner lookup
- `selling_price` — optional retail price

## Inventory Page (`src/pages/Inventory.jsx`)

### Features
- **Table view** with columns: Item, Category, Type, Stock, Alert At, Status
- **Filters**: All, Meter, Quantity, Low Stock
- **Search**: by name or barcode with live dropdown
- **Barcode scanner**: scans and highlights matching product for 3 seconds
- **Pagination**: 20 items per page
- **Add Item** (admin): modal form with fields for name, category, type, stock, threshold, unit, barcode, price
- **Edit Item** (admin): same form pre-filled
- **Summary cards**: Meter items total + Quantity items count
- **Status**: Low Stock indicator (red) vs OK (green)

### Stock Operations

**Stock IN (Purchases)** — `src/pages/Purchases.jsx`
- Admin-only page
- Barcode scan auto-selects item and fills last unit cost
- Bill number, supplier, date, item, quantity/meters, unit cost
- Validates bill number uniqueness
- DB trigger `on_inventory_purchase` / `apply_inventory_purchase()` auto-increments stock
- Purchase history table with expense tracking

**Stock OUT (Sales)** — via POS billing
- Services linked to inventory auto-deduct on sale
- Materials added directly as cart items
- DB trigger `on_sale_item_inventory` / `apply_sale_inventory_deduction()`:
  - Row-level lock (`FOR UPDATE`)
  - Validates sufficient stock
  - Deducts with CHECK constraint (`current_stock >= 0`)
  - Raises exception on shortfall → entire transaction rolled back

### Low Stock Detection
- `isLowStock()` in `lib/format.js`: returns true if `current_stock <= low_stock_threshold`
- Shown on:
  - Dashboard (LowStockBanner + alert cards)
  - Inventory page (Low Stock filter + status column)
  - Reports (Low Stock tab)

### Barcode Scanner
- Custom hook `useBarcodeScanner` in `src/hooks/useBarcodeScanner.js`
- Listens for keyboard input sequences (physical scanner emulates keyboard)
- Used in:
  - Inventory page — highlights matched product
  - Purchases page — auto-selects item, fetches last unit cost
  - POS page — via InventoryUsageSection / product search

## Seed Data
The schema.sql includes 11 inventory items and 6 services as seed data:
- 4 meter items (PPF Clear Gloss, PPF Matte, Tint 5%, Tint 35%)
- 7 quantity items (Shampoo, Polish, Detergent, Spray Bottles, Lighters, Alcohol, Towels)
- 6 services (Full Detail, Interior Detail, PPF Installation, Window Tint, Ceramic Coating, Paint Correction)

Seed inserts use `WHERE NOT EXISTS` to avoid duplicates on re-run.
