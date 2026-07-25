import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type SupabaseClient = ReturnType<typeof createBrowserClient>;

let browserClient: SupabaseClient | null = null;

export const isSupabaseConfigured = (): boolean => Boolean(supabaseUrl && supabaseAnonKey);

/** Browser client with cookie storage (required for Google OAuth PKCE + middleware). */
export const getSupabase = (): SupabaseClient => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase environment variables are not configured.');
  }

  if (!browserClient) {
    // Untyped until packages/db Database matches current supabase-js generics
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
};
