import { createClient } from '@supabase/supabase-js';
import { authStorage } from '@/lib/authStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'Supabase credentials missing. Copy .env.example to .env and add your URL and anon key.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

export const companyInfo = {
  name: import.meta.env.VITE_COMPANY_NAME || 'Arizona Car World',
  address: import.meta.env.VITE_COMPANY_ADDRESS || 'Doha, Qatar',
  phone: import.meta.env.VITE_COMPANY_PHONE || '',
  whatsapp: import.meta.env.VITE_COMPANY_WHATSAPP || '',
  instagram: import.meta.env.VITE_COMPANY_INSTAGRAM || '@arizonacarworld',
};
