# Architecture

## System Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client (Browser / Electron)     │
│  ┌────────────────────────────────────────────┐  │
│  │         React SPA (Vite)                   │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐  │  │
│  │  │ Pages   │ │Components│ │ Stores     │  │  │
│  │  │ (12)    │ │ (18)     │ │ (auth/     │  │  │
│  │  │         │ │          │ │  theme/    │  │  │
│  │  │         │ │          │ │  language) │  │  │
│  │  └─────────┘ └──────────┘ └────────────┘  │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │         Lib utilities (14)           │  │  │
│  │  │  supabase.js  pos.js  format.js      │  │  │
│  │  │  customers.js export.js backup.js    │  │  │
│  │  │  invoicePdf.js permissions.js        │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                         │                         │
│              Supabase JS Client                    │
│                         │                         │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)               │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │  Auth      │  │  Database  │  │  RLS      │  │
│  │  (users,   │  │  (9 tables)│  │  Policies │  │
│  │  sessions) │  │            │  │           │  │
│  └────────────┘  └────────────┘  └───────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │  PostgreSQL Functions (Triggers + RPCs)    │  │
│  │  create_sale()  restore_backup()           │  │
│  │  apply_inventory_purchase()                │  │
│  │  apply_sale_inventory_deduction()          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
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

## Printing System

- **Thermal**: 80mm width, monospace font, logo, QR code, compact layout
- **A4**: Full-page layout with company header, invoice table, totals
- Both rendered as hidden DOM elements, triggered via `window.print()` or Electron's `electronAPI.printInvoice()`
- PDF generation via `jsPDF` + `jspdf-autotable` for export downloads
