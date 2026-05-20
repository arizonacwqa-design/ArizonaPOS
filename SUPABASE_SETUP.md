# Supabase login setup (step by step)

This app uses **Supabase Auth** for passwords and a **`profiles`** table for **admin** vs **employee** roles.

---

## Step 1 — Create a Supabase project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → pick a name, password, and region
3. Wait until the project status is **Active**

---

## Step 2 — Add API keys to `.env`

1. In Supabase: **Project Settings** → **API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key (starts with `eyJ…`, or **Publishable** key `sb_publishable_…`) → `VITE_SUPABASE_ANON_KEY`
3. In this repo, copy `.env.example` to `.env` (if needed) and paste the values
4. Restart the dev server: `npm.cmd run dev`

---

## Step 3 — Create the `profiles` table

1. Supabase Dashboard → **SQL** → **New query**
2. Open `supabase/migrations/001_profiles.sql` from this repo
3. Paste the full file → **Run**
4. You should see **Success** (no errors)

This creates:

- `public.profiles` (`id`, `full_name`, `role`, `created_at`)
- Row Level Security so logged-in users can read profiles
- A trigger that auto-creates a profile when a **new** auth user is added

---

## Step 4 — Create admin and employee users

1. Dashboard → **Authentication** → **Users** → **Add user** → **Create new user**
2. Create at least two users, for example:

| Email | Password | Purpose |
|-------|----------|---------|
| `admin@yourshop.com` | (strong password) | Admin login tab |
| `employee@yourshop.com` | (strong password) | Employee login tab |

3. For each user, open the user row → **Raw user meta data** and set (optional but recommended):

```json
{
  "full_name": "Shop Admin",
  "role": "admin"
}
```

```json
{
  "full_name": "Front Desk",
  "role": "employee"
}
```

4. **Confirm email** (or disable confirmation — see Step 5)

---

## Step 5 — Email confirmation (recommended for POS)

For a shop POS, you usually want **instant login without email links**:

1. **Authentication** → **Providers** → **Email**
2. Turn **off** “Confirm email” (or confirm each user manually in **Users**)

---

## Step 6 — Backfill profiles for existing users

If users were created **before** Step 3, they have no profile row yet.

1. **SQL** → **New query**
2. Paste `supabase/migrations/002_backfill_profiles.sql` → **Run**

To make someone admin after backfill:

```sql
UPDATE public.profiles
SET role = 'admin', full_name = 'Shop Admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@yourshop.com' LIMIT 1
);
```

---

## Step 7 — (Optional) Full POS database

For inventory, sales, and reports tables, run the rest of:

`supabase/schema.sql`

(You can run the whole file in the SQL editor, or run it after the migrations above.)

---

## Step 8 — Test login in the app

1. `npm.cmd run dev`
2. **Admin Login** tab → admin email/password → should reach Dashboard with Purchases visible
3. Sign out → **Employee Login** tab → employee credentials → Purchases should be hidden
4. Wrong tab for role → clear message (“Use Admin Login instead”, etc.)

---

## Troubleshooting

| Symptom | Fix |
|--------|-----|
| “Supabase is not configured” | Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `.env`, restart dev |
| “Wrong email or password” | Check user exists under **Authentication → Users** |
| “Please confirm your email” | Disable confirm email (Step 5) or confirm the user in dashboard |
| “Account exists but profile is missing” | Run `002_backfill_profiles.sql` or set user metadata + re-create user |
| “Database not set up” / profile errors | Run `001_profiles.sql` |
| Admin tab rejects employee account | Expected — use the correct login tab |

---

## How roles work in code

- Login: `src/pages/Login.jsx` → `signIn(email, password, 'admin' \| 'employee')`
- Session + profile: `src/store/authStore.js` loads `profiles` where `id = auth.user.id`
- Routes: `src/components/ProtectedRoute.jsx` blocks `/purchases` for non-admins
