import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL dan Anon Key harus diisi di file .env.local');
}

// ── Client-side Supabase (anon key) ──────────────────────────
// Singleton pattern prevents "Navigator LockManager lock timed out" during Next.js HMR/Turbopack
let supabase;
const isBrowser = typeof window !== 'undefined';
const anonOptions = isBrowser 
  ? { 
      auth: { 
        // Bypass navigator.locks to fix timeout freeze on mobile Chrome/Safari
        lock: (name, acquireTimeout, fn) => fn() 
      } 
    } 
  : { auth: { persistSession: false, autoRefreshToken: false } };

if (process.env.NODE_ENV !== 'production') {
  if (!globalThis.supabaseClient) {
    globalThis.supabaseClient = createClient(supabaseUrl, supabaseAnonKey, anonOptions);
  }
  supabase = globalThis.supabaseClient;
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey, anonOptions);
}

// ── Server-side Admin Client (service role key) ──────────────
// Cached singleton — avoids creating a new connection on every server action call.
// In Vercel serverless, this persists for the lifetime of the warm function instance.
const ADMIN_CONFIG = { auth: { autoRefreshToken: false, persistSession: false } };
let _adminClient = null;

export function getAdminClient() {
  if (_adminClient) return _adminClient;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required. Add it to .env.local');
  }
  _adminClient = createClient(supabaseUrl, serviceRoleKey, ADMIN_CONFIG);
  return _adminClient;
}

export { supabase };

