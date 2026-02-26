import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL dan Anon Key harus diisi di file .env.local');
}

// Singleton pattern prevents "Navigator LockManager lock timed out" during Next.js HMR/Turbopack
let supabase;

if (process.env.NODE_ENV !== 'production') {
  if (!globalThis.supabaseClient) {
    globalThis.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  supabase = globalThis.supabaseClient;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
