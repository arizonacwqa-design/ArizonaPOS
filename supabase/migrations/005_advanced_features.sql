-- Advanced POS features: operating expenses, customers, analytics views

-- Operating expenses (rent, salaries, utilities, etc.)
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

-- Customer records (linked from sales; upserted on POS save)
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
  ON public.customers FOR UPDATE TO authenticated USING (true);

-- Optional link from sales to customers
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Monthly profit summary view
CREATE OR REPLACE VIEW public.monthly_profit_summary AS
SELECT
  date_trunc('month', COALESCE(s.sale_date, s.created_at::date))::date AS month_start,
  COALESCE(SUM(s.total_amount), 0) AS revenue,
  (
    SELECT COALESCE(SUM(p.total_cost), 0)
    FROM public.inventory_purchases p
    WHERE date_trunc('month', p.purchase_date) = date_trunc('month', COALESCE(s.sale_date, s.created_at::date))
  ) AS inventory_purchases,
  (
    SELECT COALESCE(SUM(e.amount), 0)
    FROM public.operating_expenses e
    WHERE date_trunc('month', e.expense_date) = date_trunc('month', COALESCE(s.sale_date, s.created_at::date))
  ) AS operating_expenses
FROM public.sales s
GROUP BY date_trunc('month', COALESCE(s.sale_date, s.created_at::date));

GRANT SELECT ON public.monthly_profit_summary TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operating_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
