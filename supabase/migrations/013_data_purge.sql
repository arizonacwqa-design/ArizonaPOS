-- ============================================================
-- Migration 013: Data maintenance / purge functions
-- Admin-only archiving of old or inactive records
-- ============================================================

-- Archive inactive services: marks them is_active = false instead of delete
DROP FUNCTION IF EXISTS public.archive_inactive_services;
CREATE OR REPLACE FUNCTION public.archive_inactive_services()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admin can archive services' USING ERRCODE = '42501';
  END IF;

  UPDATE public.services
  SET is_active = false
  WHERE is_active = true
    AND id NOT IN (
      SELECT DISTINCT service_id FROM public.sale_items
      WHERE service_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '365 days'
    )
    AND created_at < NOW() - INTERVAL '365 days';

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Archive old customers with no recent visits
DROP FUNCTION IF EXISTS public.archive_old_customers;
CREATE OR REPLACE FUNCTION public.archive_old_customers(p_months INTEGER DEFAULT 12)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archived_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admin can archive customers' USING ERRCODE = '42501';
  END IF;

  -- Create archive table if not exists
  CREATE TABLE IF NOT EXISTS public.customers_archive (
    id UUID PRIMARY KEY,
    full_name TEXT,
    phone TEXT,
    total_spent NUMERIC(12,2) DEFAULT 0,
    visit_count INTEGER DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT NOW()
  );

  INSERT INTO public.customers_archive (id, full_name, phone, total_spent, visit_count, last_visit_at)
  SELECT id, full_name, phone, total_spent, visit_count, last_visit_at
  FROM public.customers
  WHERE (last_visit_at IS NULL OR last_visit_at < NOW() - (p_months || ' months')::INTERVAL)
    AND visit_count <= 1;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  DELETE FROM public.customers
  WHERE (last_visit_at IS NULL OR last_visit_at < NOW() - (p_months || ' months')::INTERVAL)
    AND visit_count <= 1;

  RETURN archived_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_inactive_services() TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_customers(INTEGER) TO authenticated;
