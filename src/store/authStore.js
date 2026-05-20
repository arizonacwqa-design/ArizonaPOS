import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

let authSubscription = null;

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return;

    set({ loading: true });

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await get().fetchProfile(session.user);
    } else {
      set({ user: null, profile: null, loading: false });
    }

    if (!authSubscription) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (session?.user) {
            set({ loading: true });
            await get().fetchProfile(session.user);
          } else {
            set({ user: null, profile: null, loading: false });
          }
        }
      );
      authSubscription = subscription;
    }

    set({ initialized: true });
  },

  fetchProfile: async (user) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      set({ user: null, profile: null, loading: false });
      throw mapProfileError(error);
    }

    if (!profile) {
      set({ user: null, profile: null, loading: false });
      throw new Error('No profile found for this account.');
    }

    set({ user, profile, loading: false });
    return profile;
  },

  signIn: async (email, password, expectedRole) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (!data.user) {
      throw new Error('Login failed. No user returned.');
    }

    let profile;
    try {
      profile = await get().fetchProfile(data.user);
    } catch (profileError) {
      await supabase.auth.signOut();
      set({ user: null, profile: null, loading: false });
      throw profileError;
    }

    if (profile.role !== expectedRole) {
      await supabase.auth.signOut();
      set({ user: null, profile: null, loading: false });

      if (expectedRole === 'admin') {
        throw new Error('This account is not an admin. Use Employee Login instead.');
      }
      throw new Error('This account is an admin. Use Admin Login instead.');
    }

    return { user: data.user, profile };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, profile: null, loading: false });
  },

  isAdmin: () => get().profile?.role === 'admin',
  isEmployee: () => get().profile?.role === 'employee',
}));

function mapProfileError(error) {
  const code = error?.code;
  const message = error?.message || '';

  if (code === 'PGRST205' || message.includes("Could not find the table 'public.profiles'")) {
    return new Error(
      'Database not set up. Run supabase/migrations/001_profiles.sql in the Supabase SQL Editor.'
    );
  }
  if (code === '42501' || message.toLowerCase().includes('permission denied')) {
    return new Error('Cannot read profile. Check Row Level Security policies on public.profiles.');
  }

  return new Error(message || 'Failed to load user profile.');
}
