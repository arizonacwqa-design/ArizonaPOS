-- ============================================================
-- Migration 010: Move customer upsert into create_sale RPC
-- Prevents orphaned customer records when sale creation fails
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_sale(
  p_sale jsonb,
  p_items jsonb,
  p_customer jsonb DEFAULT NULL
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
  resolved_customer_id UUID;
  existing_customer RECORD;
BEGIN
  -- Upsert customer inside the same transaction
  IF p_customer IS NOT NULL AND p_customer->>'customer_name' IS NOT NULL AND NULLIF(p_customer->>'customer_name', '') IS NOT NULL THEN
    resolved_customer_id := NULL;

    IF NULLIF(p_customer->>'customer_phone', '') IS NOT NULL THEN
      SELECT id, total_spent, visit_count INTO existing_customer
      FROM public.customers
      WHERE phone = NULLIF(p_customer->>'customer_phone', '')
      LIMIT 1;

      IF FOUND THEN
        UPDATE public.customers SET
          full_name = p_customer->>'customer_name',
          total_spent = COALESCE(existing_customer.total_spent, 0) + COALESCE((p_sale->>'total_amount')::numeric, 0),
          visit_count = COALESCE(existing_customer.visit_count, 0) + 1,
          last_visit_at = NOW(),
          updated_at = NOW()
        WHERE id = existing_customer.id;
        resolved_customer_id := existing_customer.id;
      END IF;
    END IF;

    IF resolved_customer_id IS NULL THEN
      INSERT INTO public.customers (
        full_name, phone, total_spent, visit_count, last_visit_at
      ) VALUES (
        p_customer->>'customer_name',
        NULLIF(p_customer->>'customer_phone', ''),
        COALESCE((p_sale->>'total_amount')::numeric, 0),
        1,
        NOW()
      )
      RETURNING id INTO resolved_customer_id;
    END IF;
  END IF;

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
    COALESCE(resolved_customer_id, NULLIF(p_sale->>'customer_id', '')::uuid)
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
    'customer_id', resolved_customer_id,
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

GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, jsonb, jsonb) TO authenticated;
