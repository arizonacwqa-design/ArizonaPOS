# Arizona Car World — POS & Inventory System

## Overview
Desktop POS and inventory management system for **Arizona Car World**, an automotive detailing, PPF, and window tint shop in Doha, Qatar.

## Business Domain
- Auto detailing services (Full Detail, Interior Detail, Paint Correction)
- PPF (Paint Protection Film) installation
- Window tinting
- Ceramic coating
- Retail: shampoos, polishes, chemicals, towels, lighters

## Users
- **Admin**: Full access — POS, inventory management, purchases, services, reports, expenses, bookings, backup, settings
- **Employee**: POS billing, dashboard view, inventory read-only, customer read-only, bookings

## Core Features

| Feature | Description |
|---------|-------------|
| **POS Billing** | 4-step workflow: Customer/Vehicle → Services → Inventory Usage → Cart/Checkout |
| **Inventory** | Dual stock types: meter (PPF/Tint rolls) and quantity (bottles, pcs). Barcode search. Pagination. |
| **Purchases** | Multi-item stock IN with bill#, supplier, date. Auto-stock increase via DB triggers. Barcode scan. Collapsible bill history with A4 print. |
| **Services Catalog** | CRUD services, link to inventory for auto-deduction on sale. Active/inactive toggle. |
| **Reports** | 12 tabs: Daily/Monthly Sales, Search Bills, Vehicle History, Expenses, Inventory, Low Stock, Top Services, Inventory Usage, Employee Sales, Purchase Reports (with By Date/Daily/Monthly/Range views), Refunds |
| **Dashboard** | Daily/monthly sales, net profit, low stock alerts, 7-day chart, top services, top inventory usage |
| **Customers** | Auto-created from POS sales. History view with past invoices. Editable fields. |
| **Bookings** | Appointment scheduling with status workflow (booked → confirmed → in_progress → ready → delivered → cancelled) |
| **Expenses** | Operating expenses (rent, salaries, utilities). Profit calculation. |
| **Backup/Restore** | JSON export/import via Postgres RPC (atomic restore). Auto-backup prompt every 24h. |
| **Invoice** | Thermal 80mm + A4 print. PDF download (both formats). WhatsApp share. QR code. |
| **License Gate** | Full-screen license activation on first launch. Silent reverify every 24h. Edge Function `verify-license` for machine binding. |
| **WhatsApp Monitor** | Real-time WhatsApp conversation dashboard with AI on/off toggle, manual reply via n8n webhook, Supabase real-time subscriptions |

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 |
| Styling | Tailwind CSS 3 (black & gold luxury theme) |
| State | Zustand (auth, theme, language) |
| Backend/Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Desktop | Electron via electron-builder |
| Hosting | Cloudflare Workers (via Wrangler) |
| Edge Functions | Supabase Edge Functions (Deno) |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Printing | html2canvas + window.print() + CSS `@media print` with body-class scoped `display:none` for blank-page elimination |
| Excel | xlsx (SheetJS) |
| QR | qrcode package |
| Icons | lucide-react |
| Dates | date-fns |

## Key Dependencies
- `@supabase/supabase-js` ^2.49.8
- `react-router-dom` ^7.6.1
- `zustand` ^5.0.5
- `recharts` ^3.8.1
- `jspdf` ^3.0.1 + `jspdf-autotable` ^5.0.8
- `html2canvas` ^1.4.1
- `xlsx` ^0.18.5
- `qrcode` ^1.5.4
- `lucide-react` ^0.511.0

## Project Structure
```
ArizonaPOS/
├── .memory/               # System documentation (this directory)
│   ├── rules/             # Business rule files for AI reference
├── rules/                 # Strict enforcement rules (billing, inventory, license)
├── build/                 # Pre-built artifacts
├── build/                 # Pre-built artifacts
├── dist/                  # Vite dist output
├── node_modules/
├── public/                # Static assets (logo.svg, etc.)
├── scripts/
├── src/
│   ├── App.jsx            # Route definitions
│   ├── main.jsx           # Entry point
│   ├── index.css          # Global styles + Tailwind
│   ├── ErrorBoundary.jsx
│   ├── LoadingSpinner.jsx
│   ├── pages/             # 13 page components
│   ├── components/        # 20 reusable components
│   ├── lib/               # 16 utility modules
│   ├── store/             # 3 Zustand stores
│   └── hooks/             # useBarcodeScanner
├── supabase/
│   ├── schema.sql         # Combined schema
│   ├── migrations/        # 15 migration files
│   └── functions/         # Edge Functions (verify-license)
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── wrangler.jsonc
└── README.md
```

## Pages (Routes)
| Path | Page | Access |
|------|------|--------|
| `/` | Dashboard | All authenticated |
| `/pos` | POS Billing | All authenticated |
| `/inventory` | Inventory | All (admin write) |
| `/purchases` | Purchases | Admin only |
| `/reports` | Reports | All (admin extra tabs) |
| `/services` | Services | Admin only (non-admin blocked) |
| `/customers` | Customers | All (admin write) |
| `/bookings` | Bookings | All authenticated |
| `/expenses` | Expenses | Admin only |
| `/backup` | Backup | Admin only |
| `/settings` | Settings | All authenticated |
| `/whatsapp` | WhatsApp Monitor | All authenticated |
| `/login/:role` | Login | Guest only |

## Environment Variables (.env)
```
VITE_SUPABASE_URL=<project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_COMPANY_NAME=Arizona Car World
VITE_COMPANY_ADDRESS=Souq Al Qalh, East Industrial Service Road, Doha, Qatar
VITE_COMPANY_PHONE=+1 555 000 0000
VITE_COMPANY_WHATSAPP=+1 555 000 0000
VITE_COMPANY_INSTAGRAM=@arizonacarworld
VITE_DEFAULT_TAX_RATE=0
VITE_LICENSE_VERIFY_URL=https://vdjhwmdzbjztiqhyrmai.supabase.co/functions/v1/verify-license
```

## Git Remotes & Backup Workflow

| Repo | Remote | Purpose |
|------|--------|---------|
| **Primary** | `github.com/arizonacwqa-design/ArizonaPOS` | Development, testing, daily work |
| **Backup** | `github.com/mrsaifali-7898/ArizonaPOS` | Clean copy after testing, no secrets |

**Workflow:**
1. All changes made in `arizonacwqa-design` repos first
2. Test + verify (build passes, no errors)
3. Push to `arizonacwqa-design` (primary)
4. Then force-push clean copy to `mrsaifali-7898` (backup)

**Backup PAT:** Classic token stored in system (scopes: `repo`)
