import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

let authSubscription = null;
let signInInFlight = false;

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    if (get().initialized) return;

    set({ loading: true });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await get().fetchProfile(session.user);
      } else {
        set({ user: null, profile: null, loading: false });
      }
    } catch {
      set({ user: null, profile: null, loading: false });
    }

    if (!authSubscription) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (signInInFlight) return;

          if (event === 'SIGNED_OUT') {
            set({ user: null, profile: null, loading: false });
            return;
          }

          if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            if (session?.user) set({ user: session.user });
            return;
          }

          if (event === 'SIGNED_IN' && session?.user) {
            const current = get();
            if (current.user?.id === session.user.id && current.profile) {
              set({ user: session.user });
              return;
            }
            get().fetchProfile(session.user).catch(() => {
              set({ user: null, profile: null, loading: false });
            });
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

    signInInFlight = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error('Login failed. No user returned.');

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileErr) {
        await supabase.auth.signOut();
        throw mapProfileError(profileErr);
      }
      if (!profile) {
        await supabase.auth.signOut();
        throw new Error('No profile found for this account.');
      }
      if (profile.role !== expectedRole) {
        await supabase.auth.signOut();
        if (expectedRole === 'admin') {
          throw new Error('This account is not an admin. Use Employee Login instead.');
        }
        throw new Error('This account is an admin. Use Admin Login instead.');
      }

      set({ user: data.user, profile, loading: false });
      return { user: data.user, profile };
    } finally {
      signInInFlight = false;
    }
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
