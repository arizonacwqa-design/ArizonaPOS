# Known Issues & Bugs

## Resolved

### 1. Stock Race Condition (Fixed in Migration 006)
- **Status**: RESOLVED
- **Fix**: Migration 006 replaces the trigger with `SELECT ... FOR UPDATE` row locking + strict CHECK constraint + RAISE EXCEPTION on shortfall.

### 2. RLS Gaps on Sales (Fixed in Migration 006)
- **Status**: RESOLVED
- **Fix**: New policies restrict INSERT to own employee_id (or admin), UPDATE to own or admin, DELETE to admin only.

### 3. Backup Restore Not Atomic (Fixed in Migration 006)
- **Status**: RESOLVED
- **Fix**: Postgres `restore_backup()` RPC wraps all restore in a single transaction.

### 4. Customer Upsert Runs Outside Atomic Sale
- **Status**: RESOLVED (Migration 010)
- **Fix**: Customer upsert moved inside `create_sale()` RPC via new `p_customer jsonb` parameter. If sale fails, no customer record is created.

### 5. Inventory Usage Report Uses Client-side Join
- **Status**: RESOLVED
- **Fix**: Replaced client-side computation with direct query to `inventory_usage_report` DB view.

### 6. Expense Tab Translation Wrapper
- **Status**: RESOLVED
- **Fix**: Translation wrapper returns empty string `''` instead of `JSON.stringify(val)` when encountering object translations.

### 7. Bookings Auto-cleanup
- **Status**: RESOLVED
- **Fix**: Added `archive_old_bookings()` RPC + "Archive Old" button in Bookings page (admin only).

### 8. No Data Deletion/Purge for Customers/Services
- **Status**: RESOLVED
- **Fix**: Added `archive_inactive_services()` and `archive_old_customers()` RPCs + Data Maintenance section in Settings (admin only).

### 9. Discount Input Empty String
- **Status**: RESOLVED
- **Fix**: Changed `setDiscount('')` to `setDiscount(0)` when discount field is cleared.

### 10. Barcode Scanner Timeout Hardcoded
- **Status**: RESOLVED
- **Fix**: Moved `SCAN_TIMEOUT` constant to `constants.js` and imported in `useBarcodeScanner.js`.

### 11. CustomerAutocomplete Not Reset After Sale
- **Status**: RESOLVED
- **Fix**: Added `key={lastSale?.id || 'new'}` to `CustomerAutocomplete` to force remount on new sale.

### 12. Purchase Bill Number Race Condition
- **Status**: RESOLVED
- **Fix**: Added partial unique index `idx_inventory_purchases_bill_number_unique` at DB level. Client-side check removed, DB error handled with user-friendly message.

### 13. No Refund Mechanism
- **Status**: RESOLVED
- **Fix**: Full refund system implemented — migration 012 adds refund columns to `sales`, creates `refund_log` table, `process_refund()` RPC (validates, reverses stock, logs), `RefundDialog` UI component, Refunds tab in Reports, and refund button in ReprintModal.

## Open

*None at this time.*
