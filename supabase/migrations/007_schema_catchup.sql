-- Arizona Car World POS — Schema catch-up
-- Some installations ran an earlier version of schema.sql and skipped 004/005.
-- This migration is idempotent: safe to run on any Supabase, fully or partially
-- migrated. It adds whatever's still missing so the create_sale RPC from
-- migration 006 has the columns it needs.

-- ============================================================
-- Sales: tax columns (originally added by 004_complete_pos.sql)
-- ============================================================
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- ============================================================
-- Customers table (originally added by 005_advanced_features.sql)
-- Needed so the customer_id FK below can attach.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  total_spent NUMERIC(12, 2) NOT NULL DEFAULT 0,
  visit_count INTEGER NOT NULL DEFAULT 0,
  last_visit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON public.customers (phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE INDEX IF NOT EXISTS customers_name_idx ON public.customers (full_name);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select" ON public.customers;
CREATE POLICY "customers_select"
  ON public.customers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "customers_insert" ON public.customers;
CREATE POLICY "customers_insert"
  ON public.customers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "customers_update" ON public.customers;
CREATE POLICY "customers_update"
  ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;

-- ============================================================
-- Sales: customer_id FK (originally added by 005)
-- ============================================================
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- ============================================================
-- Operating expenses table (originally added by 005)
-- Needed by the Expenses page and the monthly profit calc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.operating_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('rent', 'salary', 'utilities', 'purchases', 'other')),
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS operating_expenses_date_idx ON public.operating_expenses (expense_date);
CREATE INDEX IF NOT EXISTS operating_expenses_category_idx ON public.operating_expenses (category);

ALTER TABLE public.operating_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operating_expenses_select" ON public.operating_expenses;
CREATE POLICY "operating_expenses_select"
  ON public.operating_expenses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "operating_expenses_admin_write" ON public.operating_expenses;
CREATE POLICY "operating_expenses_admin_write"
  ON public.operating_expenses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operating_expenses TO authenticated;

-- ============================================================
-- Inventory usage report view (originally added by 004)
-- Used by the Inventory Usage tab in Reports.
-- ============================================================
CREATE OR REPLACE VIEW public.inventory_usage_report AS
SELECT
  si.id,
  s.id AS sale_id,
  s.invoice_number,
  s.sale_date,
  s.customer_name,
  si.service_name,
  si.inventory_item_id,
  ii.name AS item_name,
  ii.category AS item_category,
  ii.stock_type,
  si.inventory_deducted AS amount_used,
  s.created_at
FROM public.sale_items si
JOIN public.sales s ON s.id = si.sale_id
LEFT JOIN public.inventory_items ii ON ii.id = si.inventory_item_id
WHERE COALESCE(si.inventory_deducted, 0) > 0;

GRANT SELECT ON public.inventory_usage_report TO authenticated;
