-- Step 3: Expense tracking on purchases + richer seed data
-- Run in Supabase SQL Editor AFTER 001_profiles.sql and full schema (or schema.sql)

ALTER TABLE public.inventory_purchases
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.set_purchase_total_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  qty NUMERIC;
BEGIN
  IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
    qty := CASE
      WHEN COALESCE(NEW.meters_added, 0) > 0 THEN NEW.meters_added
      ELSE COALESCE(NEW.quantity_added, 0)
    END;
    NEW.total_cost := COALESCE(NEW.unit_cost, 0) * qty;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_total_cost ON public.inventory_purchases;
CREATE TRIGGER trg_purchase_total_cost
  BEFORE INSERT OR UPDATE ON public.inventory_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_purchase_total_cost();

-- Expense summary view (purchases = inventory expenses)
CREATE OR REPLACE VIEW public.expense_summary AS
SELECT
  date_trunc('day', purchase_date::timestamptz) AS expense_day,
  date_trunc('month', purchase_date::timestamptz) AS expense_month,
  supplier_name,
  bill_number,
  total_cost,
  purchase_date,
  created_at
FROM public.inventory_purchases;

GRANT SELECT ON public.expense_summary TO authenticated;

-- Seed inventory (meter + quantity types) — only if empty
INSERT INTO public.inventory_items (name, category, stock_type, current_stock, low_stock_threshold, unit_label)
SELECT * FROM (VALUES
  ('PPF Roll - Clear Gloss', 'PPF', 'meter', 50::numeric, 10::numeric, 'm'),
  ('PPF Roll - Matte', 'PPF', 'meter', 35::numeric, 8::numeric, 'm'),
  ('Tint Roll - 5%', 'Tint', 'meter', 40::numeric, 10::numeric, 'm'),
  ('Tint Roll - 35%', 'Tint', 'meter', 30::numeric, 8::numeric, 'm'),
  ('Car Shampoo', 'Shampoo', 'quantity', 24::numeric, 6::numeric, 'pcs'),
  ('Polish Compound', 'Polish', 'quantity', 18::numeric, 5::numeric, 'pcs'),
  ('All-Purpose Detergent', 'Detergents', 'quantity', 12::numeric, 4::numeric, 'pcs'),
  ('Spray Bottle 500ml', 'Bottles', 'quantity', 30::numeric, 10::numeric, 'pcs'),
  ('Lighters (Display Box)', 'Lighters', 'quantity', 48::numeric, 12::numeric, 'pcs'),
  ('Isopropyl Alcohol', 'Chemicals', 'quantity', 15::numeric, 4::numeric, 'pcs'),
  ('Microfiber Towels', 'Supplies', 'quantity', 60::numeric, 15::numeric, 'pcs')
) AS v(name, category, stock_type, current_stock, low_stock_threshold, unit_label)
WHERE NOT EXISTS (SELECT 1 FROM public.inventory_items LIMIT 1);

INSERT INTO public.services (name, price, category, consumption_per_unit, is_active)
SELECT * FROM (VALUES
  ('Full Detail', 800::numeric, 'Detailing', 0::numeric, true),
  ('Interior Detail', 350::numeric, 'Detailing', 0::numeric, true),
  ('PPF Installation (per panel)', 1200::numeric, 'PPF', 2::numeric, true),
  ('Window Tint - Full Car', 900::numeric, 'Tint', 3::numeric, true),
  ('Ceramic Coating', 1500::numeric, 'Coating', 0::numeric, true),
  ('Paint Correction', 950::numeric, 'Detailing', 0::numeric, true)
) AS v(name, price, category, consumption_per_unit, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.services LIMIT 1);

-- Link PPF/Tint services to inventory rolls when items exist
UPDATE public.services s
SET inventory_item_id = i.id,
    consumption_per_unit = CASE
      WHEN s.category = 'PPF' THEN 2
      WHEN s.category = 'Tint' THEN 3
      ELSE s.consumption_per_unit
    END
FROM public.inventory_items i
WHERE s.inventory_item_id IS NULL
  AND (
    (s.category = 'PPF' AND i.category = 'PPF' AND i.stock_type = 'meter')
    OR (s.category = 'Tint' AND i.category = 'Tint' AND i.stock_type = 'meter')
  );
