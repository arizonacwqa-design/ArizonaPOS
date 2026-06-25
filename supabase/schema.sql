-- Arizona Car World POS - Supabase Database Schema
-- Run this in Supabase SQL Editor: Dashboard → SQL → New Query → Paste → Run
--
-- For auth/login only, you can run migrations first:
--   supabase/migrations/001_profiles.sql
--   supabase/migrations/002_backfill_profiles.sql
-- See SUPABASE_SETUP.md for step-by-step instructions.

-- ============================================================
-- 1. PROFILES (extends Supabase Auth users)
-- Same as supabase/migrations/001_profiles.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- ============================================================
-- 2. INVENTORY ITEMS
-- type: 'meter' = PPF/Tint rolls | 'quantity' = bottles, towels, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  stock_type TEXT NOT NULL CHECK (stock_type IN ('meter', 'quantity')),
  current_stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(12, 2) NOT NULL DEFAULT 5,
  unit_label TEXT NOT NULL DEFAULT 'pcs',
  barcode TEXT,
  selling_price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory" ON inventory_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage inventory" ON inventory_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 3. SERVICES (what you sell at POS)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category TEXT,
  -- Optional: auto-deduct inventory when this service is sold
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  consumption_per_unit NUMERIC(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read services" ON services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage services" ON services
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- 4. INVENTORY PURCHASES (stock IN)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT,
  supplier_name TEXT NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_added NUMERIC(12, 2) DEFAULT 0,
  meters_added NUMERIC(12, 2) DEFAULT 0,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read purchases" ON inventory_purchases
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert purchases" ON inventory_purchases
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE OR REPLACE FUNCTION public.set_purchase_total_cost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE qty NUMERIC;
BEGIN
  IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
    qty := CASE WHEN COALESCE(NEW.meters_added, 0) > 0 THEN NEW.meters_added
           ELSE COALESCE(NEW.quantity_added, 0) END;
    NEW.total_cost := COALESCE(NEW.unit_cost, 0) * qty;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_total_cost ON inventory_purchases;
CREATE TRIGGER trg_purchase_total_cost
  BEFORE INSERT OR UPDATE ON inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_purchase_total_cost();

-- Function: increase stock when purchase is added
CREATE OR REPLACE FUNCTION apply_inventory_purchase()
RETURNS TRIGGER AS $$
DECLARE
  item_stock_type TEXT;
  add_amount NUMERIC;
BEGIN
  SELECT stock_type INTO item_stock_type FROM inventory_items WHERE id = NEW.inventory_item_id;

  IF item_stock_type = 'meter' THEN
    add_amount := COALESCE(NEW.meters_added, 0);
  ELSE
    add_amount := COALESCE(NEW.quantity_added, 0);
  END IF;

  UPDATE inventory_items
  SET current_stock = current_stock + add_amount,
      updated_at = NOW()
  WHERE id = NEW.inventory_item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_inventory_purchase ON inventory_purchases;
CREATE TRIGGER on_inventory_purchase
  AFTER INSERT ON inventory_purchases
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_purchase();

-- ============================================================
-- 5. SALES / INVOICES (POS billing)
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL DEFAULT ('INV-' || nextval('invoice_number_seq')::TEXT),
  sale_date TIMESTAMPTZ DEFAULT NOW(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  car_model TEXT,
  car_plate TEXT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'other')),
  employee_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  service_name TEXT NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL,
  line_total NUMERIC(12, 2) NOT NULL,
  inventory_item_id UUID REFERENCES inventory_items(id),
  inventory_deducted NUMERIC(12, 2) DEFAULT 0
);

ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sales" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales" ON sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can read sale_items" ON sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sale_items" ON sale_items FOR INSERT TO authenticated WITH CHECK (true);

-- Function: decrease inventory when sale item uses stock
CREATE OR REPLACE FUNCTION apply_sale_inventory_deduction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.inventory_item_id IS NOT NULL AND NEW.inventory_deducted > 0 THEN
    UPDATE inventory_items
    SET current_stock = GREATEST(0, current_stock - NEW.inventory_deducted),
        updated_at = NOW()
    WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sale_item_inventory ON sale_items;
CREATE TRIGGER on_sale_item_inventory
  AFTER INSERT ON sale_items
  FOR EACH ROW EXECUTE FUNCTION apply_sale_inventory_deduction();

-- ============================================================
-- 6. SEED DATA (sample inventory & services)
-- ============================================================
INSERT INTO inventory_items (name, category, stock_type, current_stock, low_stock_threshold, unit_label)
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
WHERE NOT EXISTS (SELECT 1 FROM inventory_items LIMIT 1);

INSERT INTO services (name, price, category)
SELECT * FROM (VALUES
  ('Full Detail', 250::numeric, 'Detailing'),
  ('Interior Detail', 120::numeric, 'Detailing'),
  ('PPF Installation (per panel)', 350::numeric, 'PPF'),
  ('Window Tint - Full Car', 280::numeric, 'Tint'),
  ('Ceramic Coating', 450::numeric, 'Coating'),
  ('Paint Correction', 300::numeric, 'Detailing')
) AS v(name, price, category)
WHERE NOT EXISTS (SELECT 1 FROM services LIMIT 1);

-- Link PPF service to PPF roll (example - update IDs after first run if needed)
-- UPDATE services SET inventory_item_id = (SELECT id FROM inventory_items WHERE name LIKE 'PPF%' LIMIT 1), consumption_per_unit = 2 WHERE name LIKE 'PPF%';
