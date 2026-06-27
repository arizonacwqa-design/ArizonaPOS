# Architecture Decisions

## Database

### Atomic Sale with Postgres RPC (v2, Migration 006)
- **Problem**: Two-terminal race condition could oversell stock; orphaned sales rows if item insert failed.
- **Solution**: `create_sale()` RPC wraps sale + items in a single Postgres transaction. Row-level `SELECT ... FOR UPDATE` locks inventory rows.
- **Trade-off**: Requires migration 006 to be applied; otherwise, fallback error message tells admin to run migration.

### Stock Deduction via Triggers vs Application Code
- **Decision**: Database triggers for stock mutations (purchases IN, sales OUT).
- **Reason**: Guarantees consistency regardless of client; prevents bypass via direct SQL.
- **Constraint**: `current_stock >= 0` CHECK constraint prevents negative stock.

### Row Level Security (RLS)
- **Decision**: All tables have RLS enabled with granular policies.
- **Approach**: Authenticated users can read most data; writes restricted by role (admin) or ownership (sales).
- **Rationale**: Supabase anon key is public; RLS is the only security boundary.

## Frontend

### Zustand over Redux/Context
- **Decision**: Zustand for state management.
- **Reason**: Minimal boilerplate, no providers needed, works well with React 18.
- **Stores**: authStore (user + profile + session), themeStore (dark/light), languageStore (en/ar).

### Invoice Printing — DOM-based vs PDF-first
- **Decision**: Hidden DOM elements rendered in React, triggered via `window.print()` with CSS print media queries.
- **Alternative considered**: jsPDF-only generation.
- **Reason**: DOM-based printing preserves Tailwind styling, supports Electron's native print dialog, easier to maintain.
- **Hybrid**: PDF downloads also available (jsPDF + jspdf-autotable) for file export.

### Client-side Customer Upsert
- **Decision**: `upsertCustomerFromSale()` runs client-side after sale, not in the atomic RPC.
- **Reason**: Customers table might not be migrated yet; non-blocking — sale succeeds even if customer record fails.
- **Trade-off**: Customer data may be incomplete if insert fails silently.

### Barcode Scanner via Keyboard Hook
- **Decision**: Custom `useBarcodeScanner` hook listens for rapid keyboard input (barcode scanners emulate keyboard).
- **Reason**: No need for native scanner SDK; works with any USB/bT scanner.
- **Implementation**: Accumulates keystrokes, detects Enter keypress as scan complete.

### Discount Capping
- **Decision**: Discount cannot exceed subtotal (capped automatically). Reported via `discountCapped` flag.
- **Reason**: Prevents negative totals from accidental over-discount.
- **Display**: Shows "Discount capped at subtotal" warning when applicable.

## Deployment

### Cloudflare Workers via Wrangler
- **Decision**: Static SPA hosted on Cloudflare Workers.
- **Reason**: Free tier, global CDN, integrates with Vite build.

### Electron Desktop Wrapper
- **Decision**: Electron for native desktop experience (printer access, file save dialogs).
- **Reason**: Thermal printer access requires native APIs; Electron provides `electronAPI.printInvoice()` bridge.
- **Build**: `electron-builder` packages the Vite build into an executable.

## i18n
- **Decision**: Simple JSON-based translation system, no i18n library.
- **Supported**: English (en), Arabic (ar) — partial coverage.
- **Store**: Language preference persisted in Zustand + localStorage.
