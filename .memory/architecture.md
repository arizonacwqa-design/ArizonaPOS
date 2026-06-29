# Architecture

## System Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Client (Browser / Electron)         │
│  ┌────────────────────────────────────────────────┐  │
│  │  ┌─────────────┐   React SPA (Vite)           │  │
│  │  │ LicenseGate │   ┌─────────┐ ┌──────────┐  │  │
│  │  │ (entry      │   │ Pages   │ │Components│  │  │
│  │  │  screen /   │   │ (12)    │ │ (19)     │  │  │
│  │  │  gate)      │   └─────────┘ └──────────┘  │  │
│  │  └─────────────┘   ┌──────────────────────┐  │  │
│  │                     │  Lib utilities (16)   │  │  │
│  │                     └──────────────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
│                         │                             │
│              Supabase JS Client / fetch()              │
│                         │                             │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                    │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  Auth      │  │  Database    │  │  Edge        │  │
│  │  (users,   │  │  (10 tables) │  │  Functions   │  │
│  │  sessions) │  │              │  │  verify-     │  │
│  └────────────┘  │  + RLS       │  │  license     │  │
│                  └─────────────┘  └──────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  PostgreSQL Functions (Triggers + RPCs)        │  │
│  │  create_sale()  restore_backup()               │  │
│  │  apply_inventory_purchase()                    │  │
│  │  apply_sale_inventory_deduction()              │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Data Flow — Sale Creation

```
1. User fills customer/vehicle info (CustomerAutocomplete)
2. User selects services → cartLines computed via cartLineFromService()
3. User optionally adds materials via cartLineFromInventory()
4. Cart totals computed via calcBillingTotals()
5. Stock validated via validateCartStock()
6. Customer upserted via upsertCustomerFromSale() → customers table
7. Supabase RPC create_sale() called:
   a. INSERT into sales (1 row)
   b. INSERT into sale_items (N rows)
   c. Trigger on_sale_item_inventory fires on each item:
      - SELECT ... FOR UPDATE (row lock)
      - Validates stock >= inventory_deducted
      - UPDATE inventory_items SET current_stock = current_stock - deducted
8. Response with sale + items returned
9. Invoice preview shown with print/PDF/WhatsApp actions
```

## Data Flow — License Verification

```
1. App mounts → LicenseGate component renders in main.jsx
2. LicenseGate checks localStorage for 'acw_license_key' + 'acw_machine_id'
3. If missing → shows full-screen entry form (black & gold theme)
   a. User enters license key
   b. Clicks Activate
   c. Generates UUID machine_id via crypto.randomUUID()
   d. POST { license_key, machine_id } to Edge Function /verify-license
   e. On valid → store both in localStorage → render app (children)
   f. On invalid → show error message
4. If present → POST to Edge Function silently
   a. If valid → render app
   b. If invalid → clear localStorage → show entry screen
   c. If server unreachable → fail open (render app)
5. Background reverify every 24h via setInterval
   a. If license deactivated/expired → clear keys → entry screen
```

## Edge Function — verify-license

```
POST /functions/v1/verify-license
Body: { license_key: string, machine_id: string }

Logic:
  1. Query licenses table by license_key
  2. If not found → { valid: false, "License key not found" }
  3. If is_active = false → { valid: false, "License is not active" }
  4. If machine_id IS NULL → bind machine_id, set activated_at → { valid: true }
  5. If machine_id matches → { valid: true }
  6. If machine_id differs → { valid: false, "already activated on another machine" }

Deployed: supabase functions deploy verify-license --no-verify-jwt
URL: env VITE_LICENSE_VERIFY_URL
```

## Authentication Flow

```
Login Page (/login/:role)
  → user enters email + password
  → authStore.signIn() calls supabase.auth.signInWithPassword()
  → fetches profile from profiles table
  → validates role matches expected role (admin vs employee)
  → sets user + profile in Zustand store
  → redirects to /
  
On app init:
  → authStore.init() calls supabase.auth.getSession()
  → subscribes to onAuthStateChange for SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED
```

## Permission Model

Permissions defined in `src/lib/permissions.js`:
- **Admin**: Full CRUD on everything
- **Employee**: POS, Dashboard, Inventory (read-only), Customers (read-only), Bookings, Settings

Route-level protection via `ProtectedRoute` component (adminOnly prop).
Page-level checks via `useAuthStore().isAdmin()`.

## Styling Architecture

- Tailwind CSS with custom design tokens
- Black & gold luxury theme (`luxury-charcoal`, `luxury-slate`, `gold-400`, etc.)
- CSS class patterns: `btn-gold`, `btn-outline`, `input-luxury`, `card-luxury`, `label-luxury`
- Print-specific: `.print-thermal` (80mm), `.print-a4`, `.no-print`
- Theme toggle (dark/light) in `themeStore.js`
- Language toggle (en/ar) in `languageStore.js`, translations in `lib/translations.js`

## Data Flow — Multi-Item Purchase

```
1. User enters bill header: bill#, supplier, date, notes
2. User clicks "Add Item" → adds row with search dropdown + qty + unit cost
3. Each row auto-calculates total (qty × unit cost)
4. Grand Total computed as sum of all row totals
5. On submit:
   a. INSERT into inventory_purchases (1 row — bill header)
   b. INSERT into purchase_items (N rows — one per item)
   c. Trigger on_purchase_item_insert fires on each item:
      - UPDATE inventory_items SET current_stock = current_stock + quantity
   d. Trigger on_purchase_item_total fires:
      - UPDATE inventory_purchases SET total_cost = SUM of purchase_items.total_cost
```

## Printing System

### Print Modes (CSS `@media print`)

All modes use the same pattern:
- `body * { display: none !important; }` — collapses all elements to zero height
- Specific print area targeted via body class + element selector: `display: block !important; position: absolute; top: 0; left: 0; width: 100%;`
- This prevents blank pages (hidden elements no longer take document space)

| Print Mode | Body Class | Print Area | Trigger |
|------------|-----------|------------|---------|
| Thermal 80mm | `print-thermal` or default | `#thermal-invoice` | `reprintBrowserPrint('thermal')` |
| A4 Invoice | `print-a4` | `#a4-invoice` | `reprintBrowserPrint('a4')` |
| Purchase Report | `printing-purchase-report` | `[data-print-area="purchase-report"]` | `printPurchaseReport()` |
| Purchase Bill | `printing-purchase-bill` | `#purchase-bill-print` | `handlePrint()` |
| Refund Report | `printing-refund-report` | `[data-print-area="refund-report"]` | `printRefundReport()` |

- **Purchase print** uses `useLayoutEffect` to ensure DOM is committed before `window.print()`
- `afterprint` event removes body class + cleans up state
- PDF generation via `jsPDF` + `jspdf-autotable` for export downloads
