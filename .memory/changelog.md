# Changelog

All notable changes to the Arizona Car World POS system.

## [Unreleased]

### Added
- .memory/ documentation directory with system analysis

### Changed (Fixes Batch — 2026-06-27)
- **Issue #4**: Customer upsert moved into `create_sale()` RPC (Migration 010). Sale failure no longer creates orphaned customer records.
- **Issue #5**: Inventory Usage Report now queries `inventory_usage_report` DB view instead of client-side join. Faster on large datasets.
- **Issue #6**: Expense translation wrapper returns empty string instead of JSON-stringified objects when translation key returns an object.
- **Issue #7**: Added `archive_old_bookings()` RPC + "Archive Old" button in Bookings page (admin only).
- **Issue #8**: Added `archive_inactive_services()` and `archive_old_customers()` RPCs + Data Maintenance section in Settings (admin only).
- **Issue #9**: Discount input now resets to `0` instead of empty string when cleared.
- **Issue #10**: Scanner timeout moved to `constants.js` as `SCAN_TIMEOUT` for easy configuration.
- **Issue #11**: `CustomerAutocomplete` now remounts on new sale via `key` prop, clearing internal state.
- **Issue #12**: Added DB-level partial unique index on `inventory_purchases.bill_number`. Client-side check removed. User-friendly error on duplicate.
- **Issue #13**: Full refund system — Migration 012 adds `refunded_at`, `refund_reason`, `refunded_by`, `original_sale_id` columns to `sales`; creates `refund_log` table; `process_refund()` RPC (admin-only, reverses stock, logs refund); `RefundDialog` component; refund button in ReprintModal; Refunds tab in Reports (admin-only). Daily/monthly totals exclude refunded sales.

### New Migrations
- `009_bill_number_unique.sql` — Partial unique index on bill_number
- `010_customer_in_rpc.sql` — Customer upsert inside create_sale()
- `011_booking_cleanup.sql` — archive_old_bookings() function
- `012_refund_system.sql` — Full refund schema + RPC
- `013_data_purge.sql` — archive_inactive_services(), archive_old_customers()

## [1.0.0] — 2026-06-25

Based on git history (most recent commit first):

### 2026-06-25 — `cef0657`
**chore: remove leftover files**
- Cleaned up miscellaneous files from project root

### 2026-06-25 — `e0c7361`
**fix: cleanup electron, add ErrorBoundary, loading states, pagination, schema update, deployment config**
- ErrorBoundary component added
- LoadingSpinner and LoadingSkeleton throughout pages
- Pagination on Inventory, Reports (SalesTable)
- Schema updates for migration 006 + 007
- Deployment config (wrangler.jsonc, Cloudflare)

### 2026-06-24 — `d777ed4`
**add Purchase Reports tab with daily/monthly/date-range views and print**
- New "Purchase Reports" tab in Reports page
- Daily, monthly, and date-range purchase views
- Print button for purchase reports

### 2026-06-24 — `a5971ad`
**live barcode dropdown: real-time name + barcode search without Enter**
- Barcode scanner integration in Purchases and Inventory
- Live dropdown search by name and barcode

### 2026-06-23 — `18947cd`
**Merge pull request #4 from feature/barcode-system**
- Barcode scanning system for POS, inventory, and purchases

### 2026-06-23 — `0b86ce7`
**feat: inventory search now accepts barcode + Enter to find by barcode**

### 2026-06-23 — `98ed736`
**Merge pull request #3 from feature/barcode-system**

### 2026-06-23 — `87d1853`
**feat: barcode scanner system - POS scan, purchase auto-fill, inventory search**

### 2026-06-22 — `20566c8`
**revert: Bookings.jsx back to original**

### 2026-06-22 — `12a22ad`
**fix: use !left syntax for left join instead of ?**

### Earlier commits (not listed in log -10 view)
- Initial schema and migrations (001-005)
- Core POS functionality
- Inventory management
- Customer CRM
- Dashboard and reporting
- Expenses tracking
- Backup/restore system
- Bookings/calendar
- Theme, i18n, settings
- Electron integration

## Milestones

### Migration 006 — Security & Atomicity
- Fixed stock race condition (row locking + CHECK constraint)
- Hardened RLS policies on sales/sale_items
- Added atomic `create_sale()` RPC
- Added atomic `restore_backup()` RPC

### Migration 007 — Schema Catchup
- Catchup for schema inconsistencies

### Migration 008 — Bookings
- Added bookings table and UI
