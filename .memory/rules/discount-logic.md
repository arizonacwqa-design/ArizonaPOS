# Discount Logic

## Source
- `src/lib/pos.js` → `calcBillingTotals()` (lines 112-135)
- UI: `src/pages/POS.jsx` (lines 559-614)
- Constants: `src/lib/constants.js` → `DEFAULT_TAX_RATE`

## Two Discount Types

### Flat Discount (QAR)
- User enters a fixed amount in QAR
- Applied directly to subtotal
- `discountType = 'flat'`

### Percentage Discount (%)
- User enters a percentage (0-100)
- Calculated as: `subtotal × (percentage / 100)`
- `discountType = 'percent'`

## Calculation Order
```
subtotal
  → discount (flat or % of subtotal)
  → afterDiscount = subtotal - discount
  → tax = afterDiscount × (taxRate / 100)  [if tax enabled]
  → total = afterDiscount + tax
```

## Capping Rules
- Discount **cannot exceed subtotal** (capped automatically)
- If discount > subtotal, `discountCapped` flag = true
- Warning shown: "Discount capped at subtotal"
- Prevents negative totals

## Impacts
- **Business**: Discounting is at staff discretion. Percentage mode includes input validation (max 100).
- **Financial**: Directly reduces revenue. Capped at subtotal to prevent negative revenue.
- **Inventory**: Discount does NOT affect inventory deduction — stock is deducted based on cart quantity regardless of price.

## Notes
- Discount applies BEFORE tax calculation
- Tax is calculated on the discounted amount (`afterDiscount`)
- Discount can be 0 (no discount)
