-- Arizona Car World POS — Multi-Item Purchases
-- Creates purchase_items table and modifies existing triggers
-- to support both single-item (backward compatible) and multi-item purchases.

-- 1. Allow null inventory_item_id for multi-item bill headers
ALTER TABLE public.inventory_purchases
  ALTER COLUMN inventory_item_id DROP NOT NULL;

-- 2. Create purchase_items table
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.inventory_purchases(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id),
  item_name TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_items_select" ON public.purchase_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_items_insert" ON public.purchase_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Modify set_purchase_total_cost to handle null inventory_item_id
CREATE OR REPLACE FUNCTION public.set_purchase_total_cost()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE qty NUMERIC;
BEGIN
  IF NEW.inventory_item_id IS NULL THEN
    IF NEW.total_cost IS NULL THEN
      NEW.total_cost := 0;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.total_cost IS NULL OR NEW.total_cost = 0 THEN
    qty := CASE WHEN COALESCE(NEW.meters_added, 0) > 0 THEN NEW.meters_added
           ELSE COALESCE(NEW.quantity_added, 0) END;
    NEW.total_cost := COALESCE(NEW.unit_cost, 0) * qty;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Modify apply_inventory_purchase to skip when inventory_item_id IS NULL
CREATE OR REPLACE FUNCTION public.apply_inventory_purchase()
RETURNS TRIGGER AS $$
DECLARE
  item_stock_type TEXT;
  add_amount NUMERIC;
BEGIN
  IF NEW.inventory_item_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT stock_type INTO item_stock_type FROM public.inventory_items WHERE id = NEW.inventory_item_id;
  IF item_stock_type = 'meter' THEN
    add_amount := COALESCE(NEW.meters_added, 0);
  ELSE
    add_amount := COALESCE(NEW.quantity_added, 0);
  END IF;
  UPDATE public.inventory_items
  SET current_stock = current_stock + add_amount,
      updated_at = NOW()
  WHERE id = NEW.inventory_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create purchase_items stock trigger
CREATE OR REPLACE FUNCTION public.apply_purchase_item_stock()
RETURNS TRIGGER AS $$
DECLARE
  v_stock_type TEXT;
BEGIN
  SELECT stock_type INTO v_stock_type FROM public.inventory_items WHERE id = NEW.inventory_item_id;
  UPDATE public.inventory_items
  SET current_stock = current_stock + NEW.quantity,
      updated_at = NOW()
  WHERE id = NEW.inventory_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_item_insert ON public.purchase_items;
CREATE TRIGGER on_purchase_item_insert
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_purchase_item_stock();

-- 6. Create trigger to update bill total_cost from purchase_items
CREATE OR REPLACE FUNCTION public.update_purchase_bill_total()
RETURNS TRIGGER AS $$
DECLARE
  v_purchase_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_purchase_id := OLD.purchase_id;
  ELSE
    v_purchase_id := NEW.purchase_id;
  END IF;
  UPDATE public.inventory_purchases
  SET total_cost = (
    SELECT COALESCE(SUM(total_cost), 0)
    FROM public.purchase_items
    WHERE purchase_id = v_purchase_id
  )
  WHERE id = v_purchase_id;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_purchase_item_total ON public.purchase_items;
CREATE TRIGGER on_purchase_item_total
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_purchase_bill_total();

GRANT SELECT, INSERT, UPDATE ON public.purchase_items TO authenticated;
