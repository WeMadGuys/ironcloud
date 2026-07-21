import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

let supabaseInstance: TypedSupabaseClient | null = null;

/**
 * Creates or returns the singleton Supabase client for browser/app use.
 * Uses the anon key — safe for client-side code.
 */
export const createSupabaseClient = (config: SupabaseConfig): TypedSupabaseClient => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createClient<Database>(config.url, config.anonKey, {
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
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export { createClient };
export type { SupabaseClient } from '@supabase/supabase-js';
