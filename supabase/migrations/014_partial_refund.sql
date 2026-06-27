-- ============================================================
-- Migration 014: Single-Item & Custom Refund
-- Adds refunded_amount to sales, updates stock reversal,
-- and replaces process_refund with process_partial_refund
-- ============================================================

-- Add refunded_amount to track partial refunds
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Drop old single-purpose functions
DROP FUNCTION IF EXISTS public.reverse_stock_for_sale(UUID);
DROP FUNCTION IF EXISTS public.process_refund(UUID, TEXT, UUID);

-- ============================================================
-- Reverse stock for specific sale items (or all if items param is NULL)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_stock_for_sale(
  p_sale_id UUID,
  p_item_ids UUID[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_item_ids IS NULL THEN
    -- Restore all inventory for the sale
    UPDATE inventory_items ii
    SET current_stock = ii.current_stock + si.total_deducted,
        updated_at = NOW()
    FROM (
      SELECT inventory_item_id, SUM(inventory_deducted) AS total_deducted
      FROM public.sale_items
      WHERE sale_id = p_sale_id AND inventory_item_id IS NOT NULL AND inventory_deducted > 0
      GROUP BY inventory_item_id
    ) si
    WHERE ii.id = si.inventory_item_id;
  ELSE
    -- Restore only for specific sale_item IDs
    UPDATE inventory_items ii
    SET current_stock = ii.current_stock + si.total_deducted,
        updated_at = NOW()
    FROM (
      SELECT inventory_item_id, SUM(inventory_deducted) AS total_deducted
      FROM public.sale_items
      WHERE sale_id = p_sale_id AND id = ANY(p_item_ids)
        AND inventory_item_id IS NOT NULL AND inventory_deducted > 0
      GROUP BY inventory_item_id
    ) si
    WHERE ii.id = si.inventory_item_id;
  END IF;
END;
$$;

-- ============================================================
-- Partial refund RPC: validates, reverses stock, logs refund
-- p_items JSONB: [{"sale_item_id":"uuid","service_name":"...","quantity":1,"line_total":100,"inventory_deducted":2}]
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_partial_refund(
  p_sale_id UUID,
  p_reason TEXT,
  p_refunded_by UUID,
  p_items JSONB
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_record RECORD;
  refund_log_entry RECORD;
  total_refunded_amount NUMERIC(12,2);
  item_ids UUID[];
  result jsonb;
BEGIN
  -- Admin only
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_refunded_by AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admin can process refunds' USING ERRCODE = '42501';
  END IF;

  -- Check sale exists
  SELECT * INTO sale_record FROM public.sales WHERE id = p_sale_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found' USING ERRCODE = 'P0002';
  END IF;

  -- Check not already fully refunded
  IF COALESCE(sale_record.refunded_amount, 0) >= sale_record.total_amount THEN
    RAISE EXCEPTION 'Sale is already fully refunded';
  END IF;

  -- Validate p_items is not empty
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item must be selected for refund';
  END IF;

  -- Calculate total and collect item IDs
  SELECT SUM((item->>'line_total')::NUMERIC(12,2))
  INTO total_refunded_amount
  FROM jsonb_array_elements(p_items) AS item;

  SELECT ARRAY_AGG((item->>'sale_item_id')::UUID)
  INTO item_ids
  FROM jsonb_array_elements(p_items) AS item;

  -- Ensure refunded_amount + new refund doesn't exceed total
  IF COALESCE(sale_record.refunded_amount, 0) + total_refunded_amount > sale_record.total_amount THEN
    RAISE EXCEPTION 'Refund amount (%) exceeds remaining balance (%)',
      total_refunded_amount, sale_record.total_amount - COALESCE(sale_record.refunded_amount, 0);
  END IF;

  -- Reverse stock for the specific items
  PERFORM public.reverse_stock_for_sale(p_sale_id, item_ids);

  -- Update sale record
  UPDATE public.sales SET
    refunded_amount = COALESCE(refunded_amount, 0) + total_refunded_amount,
    refunded_at = COALESCE(refunded_at, NOW()),
    refund_reason = CASE WHEN refunded_at IS NULL THEN p_reason ELSE refund_reason END,
    refunded_by = CASE WHEN refunded_at IS NULL THEN p_refunded_by ELSE refunded_by END
  WHERE id = p_sale_id;

  -- Log refund
  INSERT INTO public.refund_log (
    sale_id, refunded_by, refund_reason, total_refunded, items_refunded
  ) VALUES (
    p_sale_id,
    p_refunded_by,
    p_reason,
    total_refunded_amount,
    p_items
  )
  RETURNING * INTO refund_log_entry;

  -- Fetch updated sale
  SELECT * INTO sale_record FROM public.sales WHERE id = p_sale_id;

  SELECT jsonb_build_object(
    'refund', to_jsonb(refund_log_entry),
    'sale', to_jsonb(sale_record)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_partial_refund(UUID, TEXT, UUID, JSONB) TO authenticated;
