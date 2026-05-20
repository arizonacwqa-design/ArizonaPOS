-- Arizona Car World — Complete POS (tax, views, default services)
-- Run in Supabase SQL Editor after schema.sql / 001_profiles.sql

-- Tax on invoices
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Inventory usage from sales (for reports)
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

-- Default Arizona Car World services (insert if missing by name)
INSERT INTO public.services (name, price, category, consumption_per_unit, is_active)
SELECT * FROM (VALUES
  ('PPF Full Front', 4500::numeric, 'PPF', 4::numeric, true),
  ('PPF Installation (per panel)', 1200::numeric, 'PPF', 2::numeric, true),
  ('Window Tint - Full Car', 900::numeric, 'Tint', 3::numeric, true),
  ('Window Tint - Front Two', 450::numeric, 'Tint', 1.5::numeric, true),
  ('Ceramic Coating', 1500::numeric, 'Coating', 0::numeric, true),
  ('Full Detailing', 800::numeric, 'Detailing', 0::numeric, true),
  ('Exterior Polish', 350::numeric, 'Polish', 1::numeric, true),
  ('Interior Cleaning', 300::numeric, 'Detailing', 1::numeric, true)
) AS v(name, price, category, consumption_per_unit, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.services WHERE name = v.name
);

-- Link PPF/Tint/Polish services to inventory when available
UPDATE public.services s
SET inventory_item_id = i.id,
    consumption_per_unit = CASE
      WHEN s.category = 'PPF' AND s.consumption_per_unit = 0 THEN 2
      WHEN s.category = 'Tint' AND s.consumption_per_unit = 0 THEN 3
      WHEN s.category = 'Polish' AND s.consumption_per_unit = 0 THEN 1
      ELSE s.consumption_per_unit
    END
FROM public.inventory_items i
WHERE s.inventory_item_id IS NULL
  AND (
    (s.category = 'PPF' AND i.category = 'PPF' AND i.stock_type = 'meter')
    OR (s.category = 'Tint' AND i.category = 'Tint' AND i.stock_type = 'meter')
    OR (s.category = 'Polish' AND i.name ILIKE '%polish%' AND i.stock_type = 'quantity')
  );
