CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  machine_id TEXT,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licenses_select_authenticated"
  ON public.licenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "licenses_insert_admin"
  ON public.licenses FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "licenses_update_admin"
  ON public.licenses FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.licenses TO authenticated;
GRANT INSERT, UPDATE ON public.licenses TO authenticated;
