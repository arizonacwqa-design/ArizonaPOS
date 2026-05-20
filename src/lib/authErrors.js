export function getAuthErrorMessage(error) {
  const message = error?.message || 'Login failed. Please try again.';

  if (message.includes('Invalid login credentials')) {
    return 'Wrong email or password. Please check and try again.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Please confirm your email in Supabase before signing in.';
  }
  if (message.includes('not an admin')) {
    return 'This account is not an admin. Use the Employee login tab.';
  }
  if (message.includes('is an admin')) {
    return 'This account is an admin. Use the Admin login tab.';
  }
  if (message.includes('No profile found')) {
    return 'Account exists but has no profile row. In Supabase, run supabase/migrations/002_backfill_profiles.sql.';
  }
  if (message.includes('Database not set up')) {
    return 'Profiles table is missing. In Supabase SQL Editor, run supabase/migrations/001_profiles.sql (see SUPABASE_SETUP.md).';
  }
  if (message.includes('Row Level Security')) {
    return 'Profile access blocked by database security. Re-run 001_profiles.sql to restore policies.';
  }
  if (message.includes('Supabase is not configured')) {
    return 'App is not connected to Supabase. Copy .env.example to .env and add your project keys.';
  }

  return message;
}
