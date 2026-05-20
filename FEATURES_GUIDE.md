# Arizona Car World POS — Features Guide (Beginner)

This guide explains every new professional feature step by step.

---

## Before you start

1. Copy `.env.example` to `.env` and add your Supabase URL and anon key.
2. In **Supabase → SQL Editor**, run:
   - `supabase/schema.sql` (first time), or
   - `supabase/migrations/005_advanced_features.sql` (if you already have the base DB)
3. Install dependencies: `npm install`
4. Run the app: `npm run dev`

---

## 1. WhatsApp Invoice Share

**Where:** POS Billing → after you complete a sale

**Steps:**
1. Enter the customer **phone number** (include country code, e.g. `974XXXXXXXX`).
2. Complete the sale.
3. Click **WhatsApp Customer** — opens WhatsApp with a pre-filled invoice message to that number.
4. Click **Share to Shop** — opens WhatsApp with the same message (attach the PDF manually if needed).

**Tip:** Download **PDF (A4)** or **PDF (Thermal)** first, then attach the file in WhatsApp.

---

## 2. PDF Invoice Export (Black & Gold)

**Where:** POS → after sale

**Features:**
- Luxury black header with gold text
- Company logo (from `public/logo.svg`)
- QR code on invoice (scan shows invoice summary)
- **Thermal (80mm)** and **A4** PDF formats

**Steps:**
1. Complete a sale.
2. Click **PDF (A4)** or **PDF (Thermal)** — file downloads to your computer.
3. Email or print the PDF as needed.

**Print:** Use **Thermal (80mm)** or **A4 Invoice** for direct printing (Electron or browser print).

---

## 3. Dashboard Analytics

**Where:** Dashboard (home)

| Card | Meaning |
|------|---------|
| Today's Sales | Revenue from sales today |
| Monthly Sales | Revenue this calendar month |
| Net Profit | Sales − inventory purchases − operating expenses |
| Low Stock Alerts | Items at or below minimum stock |

**Also shows:**
- 7-day sales chart
- Top services this month (by quantity sold)
- Top inventory usage this month (meters/pcs deducted)
- Red **low stock** warning cards

---

## 4. Low Stock Alerts

**Automatic when:** `current stock ≤ low stock threshold` (set per item in Inventory)

**Where you see alerts:**
- Red banner at top of Dashboard (dismiss with X)
- Dashboard stat card count
- Red warning grid on Dashboard
- Inventory page filter “Low stock”
- Reports → Low Stock tab

**What to do:** Go to **Purchases** (admin) and add stock, or adjust threshold in Inventory.

---

## 5. Employee Permissions

| Feature | Admin | Employee |
|---------|-------|----------|
| POS Billing | ✅ | ✅ |
| Dashboard | ✅ | ✅ |
| Inventory view | ✅ | ✅ |
| Inventory add/edit | ✅ | ❌ |
| Purchases | ✅ | ❌ |
| Services | ✅ | ❌ |
| Expenses | ✅ | ❌ |
| Backup | ✅ | ❌ |
| Customers | ✅ | ✅ |
| Reports (most tabs) | ✅ | ✅ |
| Reports → Expenses | ✅ | ❌ |

**Login:**
- Admin: `/login/admin`
- Employee: `/login/employee`

Use the correct portal — wrong role is signed out automatically.

---

## 6. Expense Tracking

**Where:** Sidebar → **Expenses** (admin only)

**Categories:**
- Rent
- Salaries
- Utilities
- Purchases (other)
- Other

**Profit formula (month):**
```
Net Profit = Monthly Sales − Inventory Purchases − Operating Expenses
```

**Steps:**
1. Open **Expenses**.
2. Fill category, description, amount, date.
3. Click **Save Expense**.
4. View summary cards at the top for revenue, costs, and profit.

---

## 7. Backup System

**Where:** Sidebar → **Backup** (admin)

**Export:**
1. Click **Export Now**.
2. Save the JSON file (Electron: choose folder; browser: downloads folder).

**Import:**
1. Click **Choose JSON File**.
2. Confirm — data is merged by record ID.

**Daily auto backup:**
- Once per 24 hours, admin sees a prompt on login to export backup.

**Important:** Keep backup files safe. Supabase cloud also backs up your project (see Supabase dashboard).

---

## 8. Customer History

**Where:** Sidebar → **Customers**

**Automatic:** Each completed sale with a phone number creates/updates a customer record.

**Steps:**
1. Open **Customers**.
2. Search by name or phone.
3. Click **View history** — see past invoices and line items.
4. In POS, type customer name — suggestions appear from past customers.

---

## 9. UI Improvements

- Smoother **fade-in** and **slide-up** animations
- **Loading skeletons** on Dashboard and Expenses
- **Luxury tables** with gold headers and hover rows
- Black & gold automotive theme throughout
- Improved low-stock red warning styling

---

## 10. Quick daily workflow

1. **Morning:** Check Dashboard for low stock and yesterday’s sales.
2. **During day:** Use **POS Billing** for each customer.
3. **After each sale:** Print or PDF → WhatsApp to customer.
4. **Stock in:** Admin → **Purchases** when supplies arrive.
5. **End of month:** **Expenses** for rent/salaries → check profit on Dashboard.
6. **Weekly:** Admin → **Backup** → Export Now.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `operating_expenses` table missing | Run migration `005_advanced_features.sql` |
| WhatsApp button disabled | Add customer phone on POS |
| PDF download fails | Run `npm install` (needs `qrcode` package) |
| Employee sees admin page | Use correct login URL; employees are redirected |
| Customers empty | Complete at least one sale with name + phone |

---

## Environment variables

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_COMPANY_NAME=Arizona Car World
VITE_COMPANY_WHATSAPP=974XXXXXXXX
```

For questions, see also `BEGINNER_GUIDE.md` and `SUPABASE_SETUP.md`.
