/**
 * @tracking_management_system/db
 * Exports pre-configured Supabase client helpers shared across apps.
 */

const { createClient } = require("@supabase/supabase-js");

/** Browser / React Native client (anon key, respects RLS) */
function createBrowserClient(supabaseUrl, supabaseAnonKey) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

/** Server-side / Edge Function client (service role, bypasses RLS) */
function createServerClient(supabaseUrl, supabaseServiceRoleKey) {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = { createBrowserClient, createServerClient };
