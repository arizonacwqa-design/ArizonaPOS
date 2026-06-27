# Refund Rules

## Status: ✅ IMPLEMENTED (Migration 012)

Full refund system with stock reversal, audit logging, and admin-only access.

## Implementation

### Database
- `sales` table: `refunded_at`, `refund_reason`, `refunded_by`, `original_sale_id` columns
- `refund_log` table: immutable audit trail of every refund
- `reverse_stock_for_sale(p_sale_id)`: restores inventory deducted by sale items
- `process_refund(p_sale_id, p_reason, p_refunded_by)`: admin-only RPC that validates, reverses stock, and logs

### UI
- **Reports → ReprintModal**: "Refund This Invoice" button (admin only, hidden if already refunded)
- **Reports → Refunds tab** (admin only): shows full refund log with date, invoice, customer, amount, reason, processor
- **Reports → Daily/Monthly**: refunded sales excluded from totals

## Enforcement Status

| Rule | Status | Mechanism |
|------|--------|-----------|
| Admin-only refunds | ✅ Enforced | RPC checks role |
| Stock reversal on refund | ✅ Enforced | `reverse_stock_for_sale()` called by RPC |
| Refund audit trail | ✅ Enforced | `refund_log` INSERT inside same transaction |
| Cannot refund twice | ✅ Enforced | RPC checks `refunded_at IS NULL` |
| Refund excluded from revenue | ✅ Enforced | Client-side `activeSales` filter |
