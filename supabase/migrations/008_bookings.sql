-- Arizona Car World POS - bookings and appointment calendar
-- Run after the existing POS migrations.

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  car_model TEXT,
  car_plate TEXT,
  service_summary TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 120 CHECK (duration_minutes >= 15),
  status TEXT NOT NULL DEFAULT 'booked' CHECK (
    status IN ('booked', 'confirmed', 'in_progress', 'ready', 'delivered', 'cancelled')
  ),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_scheduled_at_idx ON public.bookings (scheduled_at);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_customer_phone_idx ON public.bookings (customer_phone);
CREATE INDEX IF NOT EXISTS bookings_assigned_to_idx ON public.bookings (assigned_to);

CREATE OR REPLACE FUNCTION public.touch_booking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS touch_booking_updated_at ON public.bookings;
CREATE TRIGGER touch_booking_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_booking_updated_at();

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_select_authenticated" ON public.bookings;
CREATE POLICY "bookings_select_authenticated"
  ON public.bookings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "bookings_insert_authenticated" ON public.bookings;
CREATE POLICY "bookings_insert_authenticated"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "bookings_update_owner_assignee_or_admin" ON public.bookings;
CREATE POLICY "bookings_update_owner_assignee_or_admin"
  ON public.bookings FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "bookings_delete_admin" ON public.bookings;
CREATE POLICY "bookings_delete_admin"
  ON public.bookings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
