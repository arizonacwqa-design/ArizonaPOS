# Billing Rules

> See also the **strict enforcement version** at `rules/billing.md` (project root) which
> documents which rules are enforced in code vs. which are gaps.

## Source
- UI: `src/pages/POS.jsx`
- Business logic: `src/lib/pos.js`
- DB: `create_sale()` RPC in `supabase/migrations/006_pos_security_atomicity.sql`

## Required Fields
- **Customer name** — mandatory, max 100 chars
- At least **1 cart item** (service or material)

## Workflow
1. Enter customer/vehicle details
2. Select services (adds to cart with auto stock deduction preview)
3. Optionally add materials (non-revenue stock items)
4. Set discount, tax, payment method → complete sale

## Completion Rules
- Sale is created atomically via `create_sale()` Postgres RPC
- If `create_sale()` RPC is missing (migration 006 not run), the system shows an error directing admin to run the migration
- On success: cart clears, customer resets, invoice number shown
- Customer record is upserted BEFORE the sale (known issue: orphaned customer if sale fails)

## Post-Sale Actions
- Print Thermal (80mm)
- Print A4
- Download PDF (A4 or Thermal)
- WhatsApp to customer (requires phone)
- Share to shop WhatsApp

## Minimum Quantities
- Services: minimum quantity = 1
- Materials (meter type): minimum = 0.1, step = 0.5
- Materials (quantity type): minimum = 1, step = 1

## Impacts
- **Business**: Core revenue-generating transaction. Every sale must be accurate.
- **Financial**: Each sale adds to daily/monthly revenue totals. Discounts reduce margin.
- **Inventory**: Services linked to inventory auto-deduct stock. Materials directly deduct stock. Insufficient stock blocks the sale.

## Restrictions
- Employees can only create sales assigned to themselves (RLS policy)
- Admins can create sales for any employee
- Stock shortfall rolls back the entire transaction — no partial sales
