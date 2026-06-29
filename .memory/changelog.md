# Changelog

All notable changes to the Arizona Car World POS system.

## [Unreleased]

### Added
- **Multi-item Purchases**: Redesigned Purchases page with per-bill item rows, grand total, collapsible history, A4 print
- **Migration 016**: `purchase_items` table, modified triggers for multi-item stock-in
- **PurchasePrint component**: A4 print layout for purchase bills
- **Reports**: Multi-item view in purchase report (daily/monthly/range)
- **License Gate system**: Full-screen license activation on app launch (`LicenseGate.jsx`)
- **verify-license Edge Function**: Supabase Edge Function for license key validation + machine binding
- **Migration 015**: `licenses` table with RLS for license key management
- **Env var**: `VITE_LICENSE_VERIFY_URL` for configurable Edge Function URL
- **Strict rules**: `rules/license.md` — 8 enforced rules for license verification
- **Seed license key**: `ACW-2025-MAIN-001` inserted in Supabase

### Changed
- `src/main.jsx`: Wrapped `<App />` in `<LicenseGate>` component
- `src/components/LicenseGate.jsx`: Hardcoded URL → reads from `import.meta.env.VITE_LICENSE_VERIFY_URL`
- `.env.example`: Added `VITE_LICENSE_VERIFY_URL`
- .memory/ documentation directory with system analysis
- Partial refund system: single-item & custom refund (Migration 014, RefundDialog rewrite)
- ErrorBoundary wrapping on all routes
- Daily/Monthly/All refund views with print in Reports
- Dual remote Git workflow documentation
- **Refund slip printing**: Thermal (80mm) + A4 print popup with auto-close
- **Refund PDF download**: A4 + Thermal format via jsPDF
- **Refund WhatsApp sharing**: Customer + Shop share buttons with refund details
- **Bill-wise refund report**: RefundTable grouped by sale_id instead of individual transactions
- **Migration 014** applied live via supabase CLI (process_partial_refund RPC)
- `refundPdf.js` — PDF generation module for refund slips
- `buildRefundWhatsAppMessage()` in share.js for refund messaging

### Fixed
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
- **process_partial_refund 400 error**: Removed `JSON.stringify(items)` — caused double-encoding of JSON array
- **Refund amount input invisible**: Changed `bg-luxury-card` (invalid class) to `bg-white text-black`
- **Logo broken in print popup**: Changed relative `/logo.png` to absolute `window.location.origin + '/logo.png'`
- **ErrorBoundary UI**: Upgraded with Reload Page, Try Again, and Copy error details buttons matching Arizona theme

### New Migrations
- `009_bill_number_unique.sql` — Partial unique index on bill_number
- `010_customer_in_rpc.sql` — Customer upsert inside create_sale()
- `011_booking_cleanup.sql` — archive_old_bookings() function
- `012_refund_system.sql` — Full refund schema + RPC
- `013_data_purge.sql` — archive_inactive_services(), archive_old_customers()
- `014_partial_refund.sql` — Single-item & custom refund (process_partial_refund RPC)

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
