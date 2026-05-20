# Arizona Car World POS — Beginner Guide

This guide explains the full system in simple steps: database setup, daily use, and how each feature works.

---

## Part 1 — One-time setup

### Step 1: Install the app on your computer

1. Open a terminal in the project folder (`ArizonaPOS`)
2. Run: `npm.cmd install`
3. Copy `.env.example` to `.env` and add your Supabase URL and key (see `SUPABASE_SETUP.md`)

### Step 2: Create database tables in Supabase

Run these SQL files **in order** in Supabase → **SQL** → **New query**:

| Order | File | What it creates |
|-------|------|-----------------|
| 1 | `supabase/migrations/001_profiles.sql` | Login users + admin/employee roles |
| 2 | `supabase/migrations/002_backfill_profiles.sql` | Profiles for existing users |
| 3 | `supabase/schema.sql` | Inventory, services, sales, purchases |
| 4 | `supabase/migrations/003_pos_enhancements.sql` | Expense costs + sample products |

### Step 3: Create users

1. Supabase → **Authentication** → **Users** → add admin and employee
2. Set metadata: `{ "full_name": "Your Name", "role": "admin" }` or `"employee"`
3. Turn off **Confirm email** for faster shop login

### Step 4: Start the app

```powershell
npm.cmd run dev
```

Log in with **Admin** or **Employee** tab.

---

## Part 2 — How inventory works

### Two stock types

| Type | Used for | Unit | Examples |
|------|----------|------|----------|
| **Meter** | Rolls | meters (m) | PPF rolls, tint rolls |
| **Quantity** | Countable items | pieces (pcs) | Shampoo, polish, detergents, bottles, lighters, chemicals |

### Stock goes DOWN automatically

When you sell a service at **POS** that is linked to inventory:

- Example: PPF panel uses **2 meters** per quantity sold
- The database trigger subtracts stock after billing

Configure links in **Services** (admin): pick inventory item + “usage per qty sold”.

### Stock goes UP automatically

When you record a **Purchase** (admin):

- Enter bill number, supplier, date, item, meters or quantity, and cost
- Stock increases via database trigger
- Cost is tracked as **expense**

---

## Part 3 — Daily workflow

### Morning — Admin

1. **Dashboard** — check low stock alerts and yesterday’s sales
2. **Purchases** — record any stock received from suppliers
3. **Services** — update prices or link new services to inventory

### During the day — Employee or Admin

1. **POS Billing**
   - Enter customer name, phone, car model, plate
   - Tap services to add to cart
   - Apply discount if needed
   - Choose payment method → **Complete Sale**
   - **Print Invoice** (thermal 80mm layout)

### End of day — Admin

1. **Reports** → Daily or Monthly sales
2. **Export PDF** or **Export Excel** for records
3. **Expenses** tab — review purchase costs for the month

---

## Part 4 — Permissions

| Feature | Admin | Employee |
|---------|-------|----------|
| Dashboard | Yes | Yes |
| POS Billing | Yes | Yes |
| Inventory view | Yes | Yes |
| Add/edit inventory | Yes | No |
| Purchases | Yes | No |
| Services catalog | Yes | No |
| Reports | Yes | Yes |
| Export reports | Yes | Yes |

---

## Part 5 — Database tables (simple map)

```
auth.users          → login email/password (Supabase Auth)
profiles            → name + role (admin | employee)
inventory_items     → stock (meter or quantity)
services            → what you sell at POS + optional stock link
inventory_purchases → stock IN + expenses
sales               → invoice header
sale_items          → line items + stock deduction
```

---

## Part 6 — Invoice / thermal print

Printed receipt includes (from `.env`):

- Company logo
- Name, address, phone, WhatsApp, Instagram
- Invoice number (auto: INV-1001, INV-1002, …)
- Date and time
- Customer and vehicle details
- Line items, discount, total, payment method

In Electron: **Print Invoice** uses the system print dialog. Use an 80mm thermal printer if available.

---

## Part 7 — Troubleshooting

| Problem | Solution |
|---------|----------|
| Login fails | Run profile SQL; check user exists in Supabase |
| No services on POS | Run `schema.sql` seed or add services in **Services** |
| Stock not decreasing | Link service to inventory in **Services** |
| Export buttons missing data | Select a date/month that has sales |
| Expenses show 0 | Run `003_pos_enhancements.sql`; enter unit cost on purchases |

---

## Part 8 — File reference

| Path | Purpose |
|------|---------|
| `src/pages/POS.jsx` | Checkout & print |
| `src/pages/Inventory.jsx` | Stock list & edit |
| `src/pages/Purchases.jsx` | Stock in & expenses |
| `src/pages/Services.jsx` | Service prices & stock links |
| `src/pages/Dashboard.jsx` | Overview & alerts |
| `src/pages/Reports.jsx` | Reports & export |
| `supabase/schema.sql` | Full database |

For auth-only setup, see `SUPABASE_SETUP.md`.
