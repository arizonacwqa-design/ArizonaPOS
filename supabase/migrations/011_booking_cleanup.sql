-- ============================================================
-- Migration 011: Booking auto-cleanup function
-- Allows admin to archive old delivered/cancelled bookings
-- ============================================================

CREATE OR REPLACE FUNCTION public.archive_old_bookings(p_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admin can archive bookings' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.bookings
  WHERE status IN ('delivered', 'cancelled')
    AND updated_at < NOW() - (p_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.archive_old_bookings(INTEGER) TO authenticated;
