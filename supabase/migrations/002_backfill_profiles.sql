-- Step 2: Create profile rows for users that already exist in Auth
-- Run AFTER 001_profiles.sql and AFTER you create users in Authentication → Users

INSERT INTO public.profiles (id, full_name, role)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'employee')
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = u.id
);

-- Example: promote a specific user to admin (replace email)
-- UPDATE public.profiles
-- SET role = 'admin', full_name = 'Shop Admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@arizonacarworld.com' LIMIT 1);
