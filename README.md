# Arizona Car World — POS & Inventory System

Desktop POS and inventory app for **Arizona Car World** (detailing, PPF, tint).

**Stack:** React · Tailwind CSS · Electron · Supabase

---

## What You Get

| Feature | Description |
|--------|-------------|
| **POS Billing** | Customer, phone, car, services, discount, payment, print invoice |
| **Meter inventory** | PPF & tint rolls tracked in **meters** (e.g. 15m, 22m) |
| **Quantity inventory** | Bottles, chemicals, towels in **pcs** |
| **Purchases** | Admin adds stock with bill #, supplier, date |
| **Reports** | Daily/monthly sales, inventory, low stock, top services, employee sales |
| **Login** | Admin & Employee roles |
| **Dashboard** | Black & gold UI, sales stats, low stock alerts |
| **Thermal print** | 80mm invoice with logo, contact info, invoice # |

---

## Step-by-Step Setup (Beginners)

### Step 1 — Install Node.js

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS** version and install it
3. Open **PowerShell** and check:

```powershell
node -v
npm -v
```

You should see version numbers (e.g. `v22.x` and `10.x`).

---

### Step 2 — Install project dependencies

Open PowerShell in this folder:

```powershell
cd "C:\Users\Q\OneDrive\Desktop\ArizonaPOS"
npm install
```

This downloads React, Electron, Tailwind, Supabase, and other packages into `node_modules`.

---

### Step 3 — Create a Supabase project (free cloud database)

1. Sign up at [https://supabase.com](https://supabase.com)
2. Click **New Project**
3. Choose a name (e.g. `arizona-car-world`) and set a database password
4. Wait until the project is ready

---

### Step 4 — Run the database schema

1. In Supabase, open **SQL Editor** → **New query**
2. Open the file `supabase/schema.sql` from this project
3. Copy **all** the SQL and paste it into the editor
4. Click **Run**

This creates tables for inventory, sales, purchases, employees, and sample data.

---

### Step 5 — Connect the app to Supabase

1. In Supabase: **Settings** → **API**
2. Copy:
   - **Project URL**
   - **anon public** key
3. In this project folder, copy the example env file:

```powershell
copy .env.example .env
```

4. Open `.env` in Notepad and paste your values:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_COMPANY_NAME=Arizona Car World
VITE_COMPANY_ADDRESS=Souq Al Qalh, East Industrial Service Road, Doha, Qatar
VITE_COMPANY_PHONE=+1 555 000 0000
VITE_COMPANY_WHATSAPP=+1 555 000 0000
VITE_COMPANY_INSTAGRAM=@arizonacarworld
VITE_COMPANY_ADDRESS=Souq Al Qalh, East Industrial Service Road, Doha, Qatar
VITE_COMPANY_PHONE=+1 555 000 0000
VITE_COMPANY_WHATSAPP=+1 555 000 0000
VITE_COMPANY_INSTAGRAM=@arizonacarworld
```

---

### Step 6 — Create employee accounts

1. Supabase → **Authentication** → **Users** → **Add user**
2. Enter email + password
3. For **admin**, after creating the user, run in SQL Editor:

```sql
UPDATE profiles SET role = 'admin', full_name = 'Admin Name'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@yourshop.com');
```

4. For **employees**, leave role as `employee` (default)

---

### Step 7 — Run the app in development mode

```powershell
npm run dev
```

- Vite starts the React UI at `http://localhost:5173`
- Electron opens the **desktop window**

Login with the email/password you created in Step 6.

Login with the email/password you created in Step 6.

---



---

## How to Use

### POS (New sale)

1. Go to **POS Billing**
2. Enter customer name, phone, car model, plate
3. Click services to add to cart
4. Set discount and payment method
5. Click **Complete Sale** — stock deducts automatically if the service is linked to inventory
6. Click **Print Invoice** for thermal printer

### Inventory

- **Meter** items: PPF rolls, tint rolls (`15m`, `22m`)
- **Quantity** items: shampoo, polish, towels (`12 pcs`)
- Admin can **Add Item** from the Inventory page

### Purchases (Admin only)

1. Go to **Purchases**
2. Enter bill number, supplier, date
3. Select item and enter **meters** or **quantity**
4. Save — stock **increases** automatically

### Reports

- Daily / monthly sales
- Full inventory list
- Low stock alerts
- Top selling services
- Sales per employee

### Link services to inventory (auto-deduct on sale)

In Supabase SQL Editor:

```sql
UPDATE services
SET
  inventory_item_id = (SELECT id FROM inventory_items WHERE name = 'PPF Roll - Clear' LIMIT 1),
  consumption_per_unit = 2
WHERE name LIKE 'PPF%';
```

`consumption_per_unit` = meters or pcs used **per 1 quantity** of that service on the invoice.

---

## Thermal printer tips

1. Connect your 80mm thermal printer to Windows
2. Set it as the **default printer**
3. After a sale, click **Print Invoice**
4. In the print dialog, choose your thermal printer
5. Paper size: **80mm** (or custom 80mm × auto)

---

## Project structure

```
ArizonaPOS/
├── electron/          # Desktop app shell
│   ├── main.js        # Window + print handler
│   └── preload.js     # Safe bridge to React
├── src/
│   ├── pages/         # Dashboard, POS, Inventory, etc.
│   ├── components/    # UI pieces, invoice template
│   ├── lib/           # Supabase client, formatting
│   └── store/         # Login state
├── supabase/
│   └── schema.sql     # Database tables
├── public/
│   └── logo.svg       # Company logo
└── .env               # Your secrets (never commit this)
```

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Blank screen | Check `.env` has correct Supabase URL and key |
| Login fails | Confirm user exists in Supabase Auth |
| Can't add purchases | User must have `admin` role in `profiles` |
| Print does nothing | Set thermal printer as default; try browser print preview |
| `npm` not found | Reinstall Node.js and restart PowerShell |

---

## Support

Built for **Arizona Car World** — automotive detailing, PPF, and window tint.

For custom features (barcode scanning, multi-branch, etc.), extend the Supabase schema and add new pages under `src/pages/`.
