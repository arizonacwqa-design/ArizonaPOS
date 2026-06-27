-- ============================================================
-- Migration 012: Full Refund System
-- Adds refund tracking to sales + stock reversal
-- ============================================================

-- Add refund columns to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refunded_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS original_sale_id UUID REFERENCES public.sales(id);

CREATE INDEX IF NOT EXISTS idx_sales_refunded_at ON public.sales (refunded_at);
CREATE INDEX IF NOT EXISTS idx_sales_original_sale ON public.sales (original_sale_id);

-- Refund log table
CREATE TABLE IF NOT EXISTS public.refund_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  refunded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_by UUID NOT NULL REFERENCES public.profiles(id),
  refund_reason TEXT NOT NULL,
  total_refunded NUMERIC(12, 2) NOT NULL,
  items_refunded JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.refund_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refund_log_select" ON public.refund_log;
CREATE POLICY "refund_log_select"
  ON public.refund_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "refund_log_insert" ON public.refund_log;
CREATE POLICY "refund_log_insert"
  ON public.refund_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT ON public.refund_log TO authenticated;

-- ============================================================
-- Reverse stock on refund: restore inventory deducted by sale items
-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_stock_for_sale(p_sale_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
END;
$$;

-- ============================================================
-- Full refund RPC: validates, reverses stock, logs refund
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_refund(
  p_sale_id UUID,
  p_reason TEXT,
  p_refunded_by UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sale_record RECORD;
  refund_log_entry RECORD;
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

  -- Check not already refunded
  IF sale_record.refunded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sale already refunded on %', sale_record.refunded_at;
  END IF;

  -- Reverse stock
  PERFORM public.reverse_stock_for_sale(p_sale_id);

  -- Mark sale as refunded
  UPDATE public.sales SET
    refunded_at = NOW(),
    refund_reason = p_reason,
    refunded_by = p_refunded_by
  WHERE id = p_sale_id;

  -- Log refund
  INSERT INTO public.refund_log (
    sale_id, refunded_by, refund_reason, total_refunded, items_refunded
  ) VALUES (
    p_sale_id,
    p_refunded_by,
    p_reason,
    sale_record.total_amount,
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'service_name', service_name,
        'quantity', quantity,
        'line_total', line_total,
        'inventory_deducted', inventory_deducted
      )), '[]'::jsonb)
      FROM public.sale_items
      WHERE sale_id = p_sale_id
    )
  )
  RETURNING * INTO refund_log_entry;

  SELECT jsonb_build_object(
    'refund', to_jsonb(refund_log_entry),
    'sale', to_jsonb(sale_record)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_refund(UUID, TEXT, UUID) TO authenticated;
