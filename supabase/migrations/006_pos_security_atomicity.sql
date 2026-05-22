-- Arizona Car World POS — Security & Atomicity hardening
-- Addresses:
--   Bug 1: Stock race condition (two terminals overselling)
--   Bug 3: RLS gaps on sales / sale_items
--   Bug 5: Backup import not atomic
-- Run this in the Supabase SQL Editor after the earlier migrations.

-- ============================================================
-- BUG 1 — Stop overselling. The old trigger silently clamped
-- current_stock to 0. Replace with a strict trigger that locks
-- the row, validates, and fails the whole transaction on shortfall.
-- ============================================================

ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_stock_non_negative;
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_stock_non_negative CHECK (current_stock >= 0);

CREATE OR REPLACE FUNCTION public.apply_sale_inventory_deduction()
RETURNS TRIGGER AS $$
DECLARE
  available NUMERIC;
  item_name TEXT;
BEGIN
  IF NEW.inventory_item_id IS NOT NULL AND COALESCE(NEW.inventory_deducted, 0) > 0 THEN
    SELECT current_stock, name
      INTO available, item_name
      FROM public.inventory_items
      WHERE id = NEW.inventory_item_id
      FOR UPDATE;

    IF available IS NULL THEN
      RAISE EXCEPTION 'Inventory item % not found', NEW.inventory_item_id;
    END IF;

    IF available < NEW.inventory_deducted THEN
      RAISE EXCEPTION 'Insufficient stock for %: have %, need %',
        item_name, available, NEW.inventory_deducted
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.inventory_items
       SET current_stock = current_stock - NEW.inventory_deducted,
           updated_at = NOW()
     WHERE id = NEW.inventory_item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- BUG 3 — Lock down sales / sale_items.
-- Anonymous-key holders could previously INSERT anything.
-- New policy: an employee can only insert sales tied to their
-- own auth.uid(); admin can insert/update/delete anything.
-- ============================================================

DROP POLICY IF EXISTS "Authenticated can insert sales" ON public.sales;
CREATE POLICY "sales_insert_self_or_admin" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    employee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "sales_update_own_or_admin" ON public.sales;
CREATE POLICY "sales_update_own_or_admin" ON public.sales
  FOR UPDATE TO authenticated
  USING (
    employee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    employee_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "sales_delete_admin" ON public.sales;
CREATE POLICY "sales_delete_admin" ON public.sales
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Authenticated can insert sale_items" ON public.sale_items;
CREATE POLICY "sale_items_insert_owned_or_admin" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
        AND (
          s.employee_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS "sale_items_update_admin" ON public.sale_items;
CREATE POLICY "sale_items_update_admin" ON public.sale_items
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "sale_items_delete_admin" ON public.sale_items;
CREATE POLICY "sale_items_delete_admin" ON public.sale_items
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================
-- BUG 1 (atomicity) — Single RPC that creates sale + items in
-- one transaction. Stops orphaned `sales` rows when an item
-- insert fails (e.g. on stock shortfall).
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_sale(
  p_sale jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_sale public.sales;
  item jsonb;
  result jsonb;
BEGIN
  INSERT INTO public.sales (
    customer_name, customer_phone, car_model, car_plate,
    subtotal, discount, tax_rate, tax_amount, total_amount,
    payment_method, employee_id, notes, customer_id
  ) VALUES (
    p_sale->>'customer_name',
    NULLIF(p_sale->>'customer_phone', ''),
    NULLIF(p_sale->>'car_model', ''),
    NULLIF(p_sale->>'car_plate', ''),
    COALESCE((p_sale->>'subtotal')::numeric, 0),
    COALESCE((p_sale->>'discount')::numeric, 0),
    COALESCE((p_sale->>'tax_rate')::numeric, 0),
    COALESCE((p_sale->>'tax_amount')::numeric, 0),
    COALESCE((p_sale->>'total_amount')::numeric, 0),
    p_sale->>'payment_method',
    NULLIF(p_sale->>'employee_id', '')::uuid,
    NULLIF(p_sale->>'notes', ''),
    NULLIF(p_sale->>'customer_id', '')::uuid
  )
  RETURNING * INTO new_sale;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.sale_items (
      sale_id, service_id, service_name, quantity,
      unit_price, line_total, inventory_item_id, inventory_deducted
    ) VALUES (
      new_sale.id,
      NULLIF(item->>'service_id', '')::uuid,
      item->>'service_name',
      COALESCE((item->>'quantity')::numeric, 0),
      COALESCE((item->>'unit_price')::numeric, 0),
      COALESCE((item->>'line_total')::numeric, 0),
      NULLIF(item->>'inventory_item_id', '')::uuid,
      COALESCE((item->>'inventory_deducted')::numeric, 0)
    );
  END LOOP;

  SELECT jsonb_build_object(
    'sale', to_jsonb(new_sale),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', si.id,
            'sale_id', si.sale_id,
            'service_id', si.service_id,
            'service_name', si.service_name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'line_total', si.line_total,
            'inventory_item_id', si.inventory_item_id,
            'inventory_deducted', si.inventory_deducted,
            'inventory_items', CASE
              WHEN ii.id IS NULL THEN NULL
              ELSE jsonb_build_object('name', ii.name, 'stock_type', ii.stock_type)
            END
          ) ORDER BY si.id
        )
        FROM public.sale_items si
        LEFT JOIN public.inventory_items ii ON ii.id = si.inventory_item_id
        WHERE si.sale_id = new_sale.id
      ),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, jsonb) TO authenticated;

-- ============================================================
-- BUG 5 — Atomic backup restore. Postgres function body is one
-- transaction, so any failure rolls back every prior INSERT in
-- this call. Admin-only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.restore_backup(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counts jsonb := '{}'::jsonb;
  row_data jsonb;
  c int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admin can restore backups' USING ERRCODE = '42501';
  END IF;

  -- inventory_items
  c := 0;
  IF jsonb_typeof(p_payload->'tables'->'inventory_items'->'rows') = 'array' THEN
    FOR row_data IN SELECT * FROM jsonb_array_elements(p_payload->'tables'->'inventory_items'->'rows') LOOP
      INSERT INTO public.inventory_items
        (id, name, category, stock_type, current_stock, low_stock_threshold, unit_label, created_at, updated_at)
      VALUES (
        (row_data->>'id')::uuid,
        row_data->>'name',
        row_data->>'category',
        row_data->>'stock_type',
        COALESCE((row_data->>'current_stock')::numeric, 0),
        COALESCE((row_data->>'low_stock_threshold')::numeric, 5),
        COALESCE(row_data->>'unit_label', 'pcs'),
        COALESCE((row_data->>'created_at')::timestamptz, NOW()),
        COALESCE((row_data->>'updated_at')::timestamptz, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        stock_type = EXCLUDED.stock_type,
        current_stock = EXCLUDED.current_stock,
        low_stock_threshold = EXCLUDED.low_stock_threshold,
        unit_label = EXCLUDED.unit_label,
        updated_at = NOW();
      c := c + 1;
    END LOOP;
    counts := counts || jsonb_build_object('inventory_items', c);
  END IF;

  -- services
  c := 0;
  IF jsonb_typeof(p_payload->'tables'->'services'->'rows') = 'array' THEN
    FOR row_data IN SELECT * FROM jsonb_array_elements(p_payload->'tables'->'services'->'rows') LOOP
      INSERT INTO public.services
        (id, name, price, category, inventory_item_id, consumption_per_unit, is_active, created_at)
      VALUES (
        (row_data->>'id')::uuid,
        row_data->>'name',
        COALESCE((row_data->>'price')::numeric, 0),
        row_data->>'category',
        NULLIF(row_data->>'inventory_item_id', '')::uuid,
        COALESCE((row_data->>'consumption_per_unit')::numeric, 0),
        COALESCE((row_data->>'is_active')::boolean, true),
        COALESCE((row_data->>'created_at')::timestamptz, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        category = EXCLUDED.category,
        inventory_item_id = EXCLUDED.inventory_item_id,
        consumption_per_unit = EXCLUDED.consumption_per_unit,
        is_active = EXCLUDED.is_active;
      c := c + 1;
    END LOOP;
    counts := counts || jsonb_build_object('services', c);
  END IF;

  -- customers
  c := 0;
  IF jsonb_typeof(p_payload->'tables'->'customers'->'rows') = 'array' THEN
    FOR row_data IN SELECT * FROM jsonb_array_elements(p_payload->'tables'->'customers'->'rows') LOOP
      INSERT INTO public.customers
        (id, full_name, phone, email, notes, total_spent, visit_count, last_visit_at, created_at, updated_at)
      VALUES (
        (row_data->>'id')::uuid,
        row_data->>'full_name',
        NULLIF(row_data->>'phone', ''),
        NULLIF(row_data->>'email', ''),
        NULLIF(row_data->>'notes', ''),
        COALESCE((row_data->>'total_spent')::numeric, 0),
        COALESCE((row_data->>'visit_count')::int, 0),
        NULLIF(row_data->>'last_visit_at', '')::timestamptz,
        COALESCE((row_data->>'created_at')::timestamptz, NOW()),
        COALESCE((row_data->>'updated_at')::timestamptz, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        notes = EXCLUDED.notes,
        total_spent = EXCLUDED.total_spent,
        visit_count = EXCLUDED.visit_count,
        last_visit_at = EXCLUDED.last_visit_at,
        updated_at = NOW();
      c := c + 1;
    END LOOP;
    counts := counts || jsonb_build_object('customers', c);
  END IF;

  -- operating_expenses
  c := 0;
  IF jsonb_typeof(p_payload->'tables'->'operating_expenses'->'rows') = 'array' THEN
    FOR row_data IN SELECT * FROM jsonb_array_elements(p_payload->'tables'->'operating_expenses'->'rows') LOOP
      INSERT INTO public.operating_expenses
        (id, category, description, amount, expense_date, notes, created_by, created_at)
      VALUES (
        (row_data->>'id')::uuid,
        row_data->>'category',
        row_data->>'description',
        COALESCE((row_data->>'amount')::numeric, 0),
        COALESCE((row_data->>'expense_date')::date, CURRENT_DATE),
        NULLIF(row_data->>'notes', ''),
        NULLIF(row_data->>'created_by', '')::uuid,
        COALESCE((row_data->>'created_at')::timestamptz, NOW())
      )
      ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        description = EXCLUDED.description,
        amount = EXCLUDED.amount,
        expense_date = EXCLUDED.expense_date,
        notes = EXCLUDED.notes;
      c := c + 1;
    END LOOP;
    counts := counts || jsonb_build_object('operating_expenses', c);
  END IF;

  RETURN counts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
