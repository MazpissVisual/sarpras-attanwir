import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL dan Anon Key harus diisi di file .env.local');
}

// ── Client-side Supabase (anon key) ──────────────────────────
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

// ── Server-side Admin Client (service role key) ──────────────
// Shared utility — eliminates duplicate getAdminClient() in every server action file
const ADMIN_CONFIG = { auth: { autoRefreshToken: false, persistSession: false } };

export function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local');
  }
  return createClient(supabaseUrl, serviceRoleKey, ADMIN_CONFIG);
}

export { supabase };
