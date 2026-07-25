import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type TypedSupabaseClient = SupabaseClient;

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let supabaseInstance: TypedSupabaseClient | null = null;

/**
 * Creates or returns the singleton Supabase client for browser/app use.
 * Uses the anon key — safe for client-side code.
 *
 * Note: Database generics are intentionally omitted until generated types
 * match the installed @supabase/supabase-js schema shape (avoids `never` rows).
 */
export const createSupabaseClient = (config: SupabaseConfig): TypedSupabaseClient => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return supabaseInstance;
};

/**
 * Returns the existing Supabase client instance.
 * Throws if createSupabaseClient hasn't been called yet.
 */
export const getSupabaseClient = (): TypedSupabaseClient => {
  if (!supabaseInstance) {
    throw new Error(
      'Supabase client not initialized. Call createSupabaseClient() first.',
    );
  }
  return supabaseInstance;
};

/**
 * Creates a Supabase client with the service role key.
 * Only for server-side use (API routes, edge functions).
 * NEVER expose the service key to client code.
 */
export const createServiceClient = (
  url: string,
  serviceRoleKey: string,
): TypedSupabaseClient => {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export { createClient };
export type { SupabaseClient } from '@supabase/supabase-js';
