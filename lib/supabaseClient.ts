import { createClient } from '@supabase/supabase-js';

export function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing Supabase env vars');
  }
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getSupabaseService() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error('Missing Supabase service role env vars');
  }
  return createClient(url, serviceRole);
}
