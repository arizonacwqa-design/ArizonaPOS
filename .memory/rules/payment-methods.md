# Payment Methods

## Source
- Constants: `src/lib/constants.js` → `PAYMENT_METHODS` (lines 38-42)
- UI: `src/pages/POS.jsx` → Step 4 checkout
- DB: `sales.payment_method` column with CHECK constraint

## Supported Methods
| Value | Label |
|-------|-------|
| `cash` | Cash |
| `card` | Card |
| `bank_transfer` | Bank Transfer |
| `other` | Other |

## Rules
- Exactly **one** payment method per sale (no split payments)
- Method is set via dropdown in the cart/checkout section
- Default: **Cash**
- Stored in `sales.payment_method` column
- DB enforces: `CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'other'))`

## Display
- Printed on invoices (thermal and A4)
- Shown in Reports tables
- Not used for any financial reconciliation or reporting filters currently

## Business Rules
- No payment gateway integration — it's purely informational
- No partial payments or deposits
- No payment installments
- Staff selects the method based on what the customer uses

## Impacts
- **Business**: Informational only. Helps track cash vs card sales trends.
- **Financial**: No actual payment processing. All payments are assumed collected.
- **Inventory**: No impact.
