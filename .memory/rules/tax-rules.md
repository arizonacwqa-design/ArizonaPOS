# Tax Rules

## Source
- UI: `src/pages/POS.jsx` (lines 615-647)
- Logic: `src/lib/pos.js` → `calcBillingTotals()`
- Config: `src/lib/constants.js` → `DEFAULT_TAX_RATE` = `VITE_DEFAULT_TAX_RATE` (env var, default 0)

## How Tax Works
- Tax is **optional** — toggled via checkbox on the POS screen
- When enabled, user enters a tax rate (0-100%, step 0.5)
- Default tax rate is configured via `VITE_DEFAULT_TAX_RATE` in `.env`

## Calculation
```
taxAmount = afterDiscount × (taxRate / 100)
```
- Tax is calculated on the **discounted subtotal** (subtotal − discount)
- NOT on the raw subtotal

## Storage
- `tax_rate` column in `sales` table (stores the rate, e.g., 5 for 5%)
- `tax_amount` column stores the calculated tax amount
- Both persisted with each completed sale

## Business Rules
- Tax rate max: 100%
- Tax can be disabled entirely (checkbox unchecked → tax_amount = 0)
- Tax is informational only — no automatic government reporting

## Impacts
- **Business**: Tax handling is manual/staff-driven. Staff decides whether to apply tax per transaction.
- **Financial**: Tax increases the total. Stored separately for accounting.
- **Inventory**: Tax has no effect on inventory.

## Notes
- No automatic tax jurisdiction detection
- No tax exemption certificates
- No VAT/GST registration number on invoices (could be added to companyInfo)
