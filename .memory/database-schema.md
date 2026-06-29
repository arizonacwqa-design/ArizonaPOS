# Database Schema

> **Authority**: This document is the single source of truth for the Arizona Car World POS
> database structure. It must be kept in sync with `supabase/schema.sql` and all migrations
> in `supabase/migrations/`.

---

## ⚠️ Schema Change Warning System

> **Any schema change requires the following impact assessment before execution.**

### Before Proposing a Schema Change

1. Read the full table definition(s) below
2. Read all existing migration files in `supabase/migrations/`
3. Read `rules/billing.md` and `rules/inventory.md` — understand enforced rules
4. Assess backward compatibility with existing data

### Impact Assessment Template

```
Proposed change: <brief description>
Affected table(s): <tables>
Affected rule files: <links to rules/*.md>

→ Impact on billing:
   [Does this change affect invoice creation, totals, payment methods,
    discount/tax calculation, invoice numbering, or post-sale actions?]

→ Impact on inventory:
   [Does this change affect stock levels, deduction logic, purchase recording,
    low-stock detection, or barcode scanning?]

→ Impact on existing data:
   [Is a data migration required? Will existing rows be invalid?]

→ Migration plan:
   [New migration file name, SQL steps, rollback steps]

→ Approval: [Pending / Approved / Denied]
```

### Rules for Schema Changes

- **Do NOT modify schema without approval** — all changes must be reviewed
- **Ensure backward compatibility** — never remove columns, only add (or use `ALTER ... SET NULL`)
- **Every change must include a migration plan** — new file in `supabase/migrations/`
- **Never edit `schema.sql` directly** — it is a reference copy; changes go in numbered migration files
- **Existing data must be preserved** — no destructive `ALTER COLUMN ... TYPE` without explicit data conversion

---

## Overview

Supabase (PostgreSQL) database with **11 tables**, **Row Level Security**, **9 functions**, **5 triggers**, **2 views**, and **1 sequence**.

---

## Entity Relationship Diagram (Logical)

```
licenses (standalone — no FK to auth.users)

auth.users
    │
    └─── profiles (extends auth.users with role)
    │
    ├─── inventory_purchases.created_by
    ├─── sales.employee_id
    ├─── operating_expenses.created_by
    ├─── bookings.created_by
    └─── bookings.assigned_to

inventory_items
    ├─── services.inventory_item_id
    ├─── sale_items.inventory_item_id
    ├─── inventory_purchases.inventory_item_id
    └─── purchase_items.inventory_item_id

services
    └─── sale_items.service_id

inventory_purchases
    └─── purchase_items.purchase_id

sales
    ├─── sale_items.sale_id
    └─── customers (via sales.customer_id)

customers
    └─── bookings.customer_id
```

---

## Tables

### 1. `profiles`

Extends Supabase Auth users with role and display name.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK → auth.users(id) ON DELETE CASCADE | |
| full_name | TEXT | NOT NULL | |
| role | TEXT | NOT NULL, CHECK (role IN ('admin', 'employee')) | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Auto-creation**: Trigger `on_auth_user_created` → `handle_new_user()` fires on `auth.users` INSERT.

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `profiles_select_authenticated` | SELECT | All authenticated users |
| `profiles_update_own` | UPDATE | Own profile only (auth.uid() = id) |

**Grants**: `USAGE ON SCHEMA public TO authenticated`, `SELECT, UPDATE ON profiles TO authenticated`.

---

### 2. `inventory_items`

All stock items — PPF rolls, tint rolls, chemicals, supplies.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| name | TEXT | NOT NULL | |
| category | TEXT | NOT NULL | |
| stock_type | TEXT | NOT NULL, CHECK (stock_type IN ('meter', 'quantity')) | |
| current_stock | NUMERIC(12,2) | NOT NULL, DEFAULT 0, CHECK (>= 0) | |
| low_stock_threshold | NUMERIC(12,2) | NOT NULL, DEFAULT 5 | Alert trigger level |
| unit_label | TEXT | NOT NULL, DEFAULT 'pcs' | Display unit |
| barcode | TEXT | nullable | For scanner lookup |
| selling_price | NUMERIC(10,2) | nullable | Optional retail price |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `Authenticated users can read inventory` | SELECT | All authenticated |
| `Admin can manage inventory` | ALL | Admin only (`EXISTS SELECT ... role = 'admin'`) |

---

### 3. `services`

Billable services sold at POS, optionally linked to inventory for auto-deduction.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| name | TEXT | NOT NULL | |
| price | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | |
| category | TEXT | nullable | PPF, Tint, Coating, Detailing, Polish, Other |
| inventory_item_id | UUID | FK → inventory_items(id) ON DELETE SET NULL | Links stock deduction |
| consumption_per_unit | NUMERIC(12,2) | DEFAULT 0 | Meters/pcs deducted per qty sold |
| is_active | BOOLEAN | DEFAULT true | Soft-delete flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `Authenticated can read services` | SELECT | All authenticated |
| `Admin can manage services` | ALL | Admin only |

---

### 4. `inventory_purchases`

Stock IN transactions with supplier and cost tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| bill_number | TEXT | nullable | Supplier invoice reference |
| supplier_name | TEXT | NOT NULL | |
| purchase_date | DATE | NOT NULL, DEFAULT CURRENT_DATE | |
| inventory_item_id | UUID | NOT NULL, FK → inventory_items(id) ON DELETE CASCADE | |
| quantity_added | NUMERIC(12,2) | DEFAULT 0 | Used when stock_type = 'quantity' |
| meters_added | NUMERIC(12,2) | DEFAULT 0 | Used when stock_type = 'meter' |
| unit_cost | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Per-unit cost |
| total_cost | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Auto-calculated by trigger |
| notes | TEXT | nullable | |
| created_by | UUID | FK → profiles(id) | |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Triggers**:
| Trigger | Timing | Function | Purpose |
|---------|--------|----------|---------|
| `trg_purchase_total_cost` | BEFORE INSERT OR UPDATE | `set_purchase_total_cost()` | Auto-calc total_cost = unit_cost × qty |
| `on_inventory_purchase` | AFTER INSERT | `apply_inventory_purchase()` | Auto-increment inventory_items.current_stock |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `Authenticated can read purchases` | SELECT | All authenticated |
| `Admin can insert purchases` | INSERT | Admin only |

---

### 5. `sales`

Invoice records from POS billing.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| invoice_number | TEXT | UNIQUE, NOT NULL, DEFAULT 'INV-' \|\| nextval('invoice_number_seq') | Auto-generated |
| sale_date | TIMESTAMPTZ | DEFAULT NOW() | |
| customer_name | TEXT | NOT NULL | |
| customer_phone | TEXT | nullable | |
| car_model | TEXT | nullable | |
| car_plate | TEXT | nullable | |
| subtotal | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Sum of line totals before discount |
| discount | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | |
| tax_rate | NUMERIC(5,2) | NOT NULL, DEFAULT 0 | Percentage (e.g. 5 = 5%) |
| tax_amount | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | |
| total_amount | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Final grand total |
| payment_method | TEXT | NOT NULL, CHECK (IN ('cash','card','bank_transfer','other')) | |
| employee_id | UUID | FK → profiles(id), nullable | |
| notes | TEXT | nullable | |
| customer_id | UUID | FK → customers(id) ON DELETE SET NULL, nullable | Added by migration 005 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `Authenticated can read sales` | SELECT | All authenticated |
| `sales_insert_self_or_admin` | INSERT | Own employee_id or admin |
| `sales_update_own_or_admin` | UPDATE | Own or admin |
| `sales_delete_admin` | DELETE | Admin only |

---

### 6. `sale_items`

Line items for each sale.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| sale_id | UUID | NOT NULL, FK → sales(id) ON DELETE CASCADE | |
| service_id | UUID | FK → services(id), nullable | |
| service_name | TEXT | NOT NULL | Denormalized for history |
| quantity | NUMERIC(12,2) | NOT NULL, DEFAULT 1 | |
| unit_price | NUMERIC(12,2) | NOT NULL | |
| line_total | NUMERIC(12,2) | NOT NULL | |
| inventory_item_id | UUID | FK → inventory_items(id), nullable | |
| inventory_deducted | NUMERIC(12,2) | DEFAULT 0 | |

**Triggers**:
| Trigger | Timing | Function | Purpose |
|---------|--------|----------|---------|
| `on_sale_item_inventory` | AFTER INSERT | `apply_sale_inventory_deduction()` | Deduct stock with row lock + validation |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `Authenticated can read sale_items` | SELECT | All authenticated |
| `sale_items_insert_owned_or_admin` | INSERT | Sale owned by self or admin |
| `sale_items_update_admin` | UPDATE | Admin only |
| `sale_items_delete_admin` | DELETE | Admin only |

---

### 7. `customers`

Customer records auto-created from POS sales.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| full_name | TEXT | NOT NULL | |
| phone | TEXT | nullable | Unique index (non-null only) |
| email | TEXT | nullable | |
| notes | TEXT | nullable | |
| total_spent | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | Aggregate from sales |
| visit_count | INTEGER | NOT NULL, DEFAULT 0 | |
| last_visit_at | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `customers_select` | SELECT | All authenticated |
| `customers_insert` | INSERT | All authenticated |
| `customers_update` | UPDATE | All authenticated |

---

### 8. `operating_expenses`

Non-inventory expenses (rent, salaries, utilities).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| category | TEXT | NOT NULL, CHECK (IN ('rent','salary','utilities','purchases','other')) | |
| description | TEXT | NOT NULL | |
| amount | NUMERIC(12,2) | NOT NULL, DEFAULT 0 | |
| expense_date | DATE | NOT NULL, DEFAULT CURRENT_DATE | |
| notes | TEXT | nullable | |
| created_by | UUID | FK → profiles(id), nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `operating_expenses_select` | SELECT | All authenticated |
| `operating_expenses_admin_write` | ALL | Admin only |

---

### 9. `bookings`

Appointment scheduling with status workflow.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| customer_id | UUID | FK → customers(id) ON DELETE SET NULL, nullable | |
| customer_name | TEXT | NOT NULL | |
| customer_phone | TEXT | nullable | |
| car_model | TEXT | nullable | |
| car_plate | TEXT | nullable | |
| service_summary | TEXT | NOT NULL | Description of service(s) |
| scheduled_at | TIMESTAMPTZ | NOT NULL | Date + time of appointment |
| duration_minutes | INTEGER | NOT NULL, DEFAULT 120, CHECK (>= 15) | |
| status | TEXT | NOT NULL, DEFAULT 'booked', CHECK (IN ('booked','confirmed','in_progress','ready','delivered','cancelled')) | |
| assigned_to | UUID | FK → profiles(id) ON DELETE SET NULL, nullable | Staff assigned |
| notes | TEXT | nullable | |
| created_by | UUID | FK → profiles(id) ON DELETE SET NULL, nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Triggers**:
| Trigger | Timing | Function | Purpose |
|---------|--------|----------|---------|
| `touch_booking_updated_at` | BEFORE UPDATE | `touch_booking_updated_at()` | Auto-set updated_at = NOW() |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `bookings_select_authenticated` | SELECT | All authenticated |
| `bookings_insert_authenticated` | INSERT | Own (created_by = auth.uid()) or admin |
| `bookings_update_owner_assignee_or_admin` | UPDATE | Owner, assignee, or admin |
| `bookings_delete_admin` | DELETE | Admin only |

---

## Relations (Foreign Keys)

| FK | From | To | On Delete | Purpose |
|----|------|----|-----------|---------|
| FK1 | profiles.id | auth.users.id | CASCADE | Extends auth |
| FK2 | inventory_purchases.inventory_item_id | inventory_items.id | CASCADE | Purchase references item |
| FK3 | inventory_purchases.created_by | profiles.id | — | Who recorded purchase |
| FK4 | services.inventory_item_id | inventory_items.id | SET NULL | Optional stock link |
| FK5 | sales.employee_id | profiles.id | — | Who processed sale |
| FK6 | sales.customer_id | customers.id | SET NULL | Optional CRM link (added by 005) |
| FK7 | sale_items.sale_id | sales.id | CASCADE | Line items belong to sale |
| FK8 | sale_items.service_id | services.id | — | Which service was sold |
| FK9 | sale_items.inventory_item_id | inventory_items.id | — | Which stock was deducted |
| FK10 | operating_expenses.created_by | profiles.id | — | Who recorded expense |
| FK11 | bookings.customer_id | customers.id | SET NULL | Optional customer link |
| FK12 | bookings.assigned_to | profiles.id | SET NULL | Staff assigned |
| FK13 | bookings.created_by | profiles.id | SET NULL | Who created booking |

---

## Keys

### Primary Keys
All 10 tables use UUID primary keys with `DEFAULT gen_random_uuid()`.

### Unique Constraints
| Table | Column(s) | Type | Notes |
|-------|-----------|------|-------|
| sales | invoice_number | UNIQUE | Auto-generated via sequence |
| customers | phone | UNIQUE INDEX | Partial — only when phone IS NOT NULL AND phone <> '' |

### Sequences
| Name | Start | Used By |
|------|-------|---------|
| `invoice_number_seq` | 1001 | `sales.invoice_number` (formatted as `'INV-' \|\| nextval(...)`) |

---

## Constraints

### CHECK Constraints

| Table | Constraint | Definition | Purpose |
|-------|-----------|------------|---------|
| profiles | role_check | `role IN ('admin', 'employee')` | Role validation |
| inventory_items | stock_type_check | `stock_type IN ('meter', 'quantity')` | Stock type validation |
| inventory_items | stock_non_negative | `current_stock >= 0` | Prevents negative stock |
| services | — | None (inventory_item_id ON DELETE SET NULL) | |
| sales | payment_method_check | `payment_method IN ('cash','card','bank_transfer','other')` | Valid payment methods |
| operating_expenses | category_check | `category IN ('rent','salary','utilities','purchases','other')` | Valid expense categories |
| bookings | status_check | `status IN ('booked','confirmed','in_progress','ready','delivered','cancelled')` | Valid booking statuses |
| bookings | duration_check | `duration_minutes >= 15` | Minimum appointment length |

### NOT NULL Constraints

All tables enforce NOT NULL on business-critical columns (names, amounts, types).
Foreign key columns for optional relations are nullable (SET NULL behavior).

---

## Indexes

| Index Name | Table | Column(s) | Type | Notes |
|-----------|-------|-----------|------|-------|
| `profiles_role_idx` | profiles | role | B-tree | Filter by role |
| `customers_phone_unique` | customers | phone | UNIQUE, partial | WHERE phone IS NOT NULL AND phone <> '' |
| `customers_name_idx` | customers | full_name | B-tree | Search by name |
| `operating_expenses_date_idx` | operating_expenses | expense_date | B-tree | Date-range queries |
| `operating_expenses_category_idx` | operating_expenses | category | B-tree | Filter by category |
| `bookings_scheduled_at_idx` | bookings | scheduled_at | B-tree | Calendar view |
| `bookings_status_idx` | bookings | status | B-tree | Filter by status |
| `bookings_customer_phone_idx` | bookings | customer_phone | B-tree | Search by phone |
| `bookings_assigned_to_idx` | bookings | assigned_to | B-tree | Filter by staff |

No indexes on `sales` or `sale_items` tables — relies on PK lookups and sequential scans (acceptable at current data volumes).

---

### 10. `licenses`

License keys for application activation and machine binding.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| license_key | TEXT | NOT NULL, UNIQUE | The license key entered by user |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Soft disable without deleting |
| machine_id | TEXT | nullable | Bound on first activation |
| activated_at | TIMESTAMPTZ | nullable | Timestamp of first activation |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | |

**Row Level Security**:
| Policy | Action | Scope |
|--------|--------|-------|
| `licenses_select_authenticated` | SELECT | All authenticated |
| `licenses_insert_admin` | INSERT | Admin only |
| `licenses_update_admin` | UPDATE | Admin only |

**Note**: Edge Function `verify-license` uses service_role key (bypasses RLS) for machine binding. Admin CRUD uses RLS.

---

## Relations (Foreign Keys)

**licenses** is standalone — no foreign keys to other tables.

The 9 business tables maintain the FK relationships listed below:

---

## Views

### `monthly_profit_summary` (migration 005)

```sql
SELECT
  date_trunc('month', COALESCE(s.sale_date, s.created_at))::date AS month_start,
  COALESCE(SUM(s.total_amount), 0) AS revenue,
  (SELECT COALESCE(SUM(p.total_cost), 0)
   FROM inventory_purchases p
   WHERE date_trunc('month', p.purchase_date) = month_start) AS inventory_purchases,
  (SELECT COALESCE(SUM(e.amount), 0)
   FROM operating_expenses e
   WHERE date_trunc('month', e.expense_date) = month_start) AS operating_expenses
FROM sales s
GROUP BY month_start;
```

### `inventory_usage_report` (migration 007)

```sql
SELECT si.id, s.id AS sale_id, s.invoice_number, s.sale_date, s.customer_name,
       si.service_name, si.inventory_item_id, ii.name AS item_name,
       ii.category AS item_category, ii.stock_type,
       si.inventory_deducted AS amount_used, s.created_at
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
LEFT JOIN inventory_items ii ON ii.id = si.inventory_item_id
WHERE COALESCE(si.inventory_deducted, 0) > 0;
```

---

## PostgreSQL Functions

| Function | Returns | Purpose | Called By |
|----------|---------|---------|-----------|
| `handle_new_user()` | TRIGGER | Auto-create profile on auth user signup | Trigger on `auth.users` INSERT |
| `set_purchase_total_cost()` | TRIGGER | Calculate total_cost = unit_cost × qty | Trigger on `inventory_purchases` INSERT/UPDATE |
| `apply_inventory_purchase()` | TRIGGER | Increment inventory stock on purchase | Trigger AFTER INSERT on `inventory_purchases` |
| `apply_sale_inventory_deduction()` | TRIGGER | Deduct inventory with row lock + validate | Trigger AFTER INSERT on `sale_items` |
| `create_sale(jsonb, jsonb)` | jsonb | Atomic sale + items + stock deduction | RPC from `src/pages/POS.jsx` |
| `restore_backup(jsonb)` | jsonb | Atomic backup restore for 4 tables | RPC from `src/lib/backup.js` |
| `touch_booking_updated_at()` | TRIGGER | Auto-set updated_at = NOW() on booking update | Trigger BEFORE UPDATE on `bookings` |

---

## Row Level Security Summary

| Resource | SELECT | INSERT | UPDATE | DELETE |
|----------|--------|--------|--------|--------|
| profiles | All authenticated | — | Own only | — |
| inventory_items | All authenticated | Admin | Admin | Admin |
| services | All authenticated | Admin | Admin | Admin |
| inventory_purchases | All authenticated | Admin | — | — |
| sales | All authenticated | Own/admin | Own/admin | Admin |
| sale_items | All authenticated | Own/admin | Admin | Admin |
| customers | All authenticated | All authenticated | All authenticated | — |
| operating_expenses | All authenticated | Admin | Admin | Admin |
| bookings | All authenticated | Own/admin | Owner/assignee/admin | Admin |
| licenses | All authenticated | Admin | Admin | — |

---

## Migrations

Located in `supabase/migrations/`. Run in order:

| # | File | Purpose | Adds |
|---|------|---------|------|
| 1 | `001_profiles.sql` | Auth user profiles | `profiles` table, trigger, RLS |
| 2 | `002_backfill_profiles.sql` | Backfill for existing users | INSERT for auth users without profiles |
| 3 | `003_pos_enhancements.sql` | POS core | `inventory_items`, `services`, initial schema |
| 4 | `004_complete_pos.sql` | Sales + stock triggers | `sales`, `sale_items`, stock deduction trigger |
| 5 | `005_advanced_features.sql` | Customers + expenses | `customers`, `operating_expenses`, `sales.customer_id`, `monthly_profit_summary` view |
| 6 | `006_pos_security_atomicity.sql` | Security & atomicity | Row-locking stock trigger, RLS hardening, `create_sale()` RPC, `restore_backup()` RPC |
| 7 | `007_schema_catchup.sql` | Schema sync | Idempotent catchup: tax cols, customers/expenses tables, `inventory_usage_report` view |
| 8 | `008_bookings.sql` | Booking calendar | `bookings` table, triggers, RLS |
| 9 | `009_bill_number_unique.sql` | Bill# constraint | Partial unique index on `inventory_purchases.bill_number` |
| 10 | `010_customer_in_rpc.sql` | Atomic customer upsert | Customer upsert inside `create_sale()` |
| 11 | `011_booking_cleanup.sql` | Booking cleanup | `archive_old_bookings()` function |
| 12 | `012_refund_system.sql` | Full refund system | Refund columns on `sales`, `refund_log` table, `process_refund()` RPC, `reverse_stock_for_sale()` |
| 13 | `013_data_purge.sql` | Data maintenance | `archive_inactive_services()`, `archive_old_customers()` functions |
| 14 | `014_partial_refund.sql` | Partial refund | `process_partial_refund()` RPC, partial refund support |
| 15 | `015_licenses.sql` | License keys | `licenses` table, RLS, grants |
| 16 | `016_multi_item_purchases.sql` | Multi-item purchases | `purchase_items` table, modified triggers for multi-item support |

Migrations 006-015 address critical bugs & features:
- **Bug 1**: Stock race condition → `SELECT ... FOR UPDATE` + CHECK constraint
- **Bug 3**: RLS gaps on sales → granular policies
- **Bug 5**: Non-atomic backup restore → `restore_backup()` RPC
- **Bug 4 / #4**: Customer upsert orphaned → moved into `create_sale()` RPC
- **#13**: No refund mechanism → full refund system with stock reversal
- **#12**: Bill# race condition → DB-level unique index

---

## Grants

```sql
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.monthly_profit_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operating_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT SELECT ON public.refund_log TO authenticated;
GRANT SELECT ON public.licenses TO authenticated;
GRANT INSERT, UPDATE ON public.licenses TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_bookings(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_refund(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_inactive_services() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_customers(integer) TO authenticated;
```

---

## Seed Data

Inserted by `schema.sql` (guarded by `WHERE NOT EXISTS`):

**Inventory items** (11):
- 4 meter items: PPF Clear Gloss (50m), PPF Matte (35m), Tint 5% (40m), Tint 35% (30m)
- 7 quantity items: Car Shampoo (24), Polish Compound (18), All-Purpose Detergent (12), Spray Bottle 500ml (30), Lighters Display Box (48), Isopropyl Alcohol (15), Microfiber Towels (60)

**Services** (6):
- Full Detail (QAR 250), Interior Detail (QAR 120), PPF Installation per panel (QAR 350), Window Tint Full Car (QAR 280), Ceramic Coating (QAR 450), Paint Correction (QAR 300)
