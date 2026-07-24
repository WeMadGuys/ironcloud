import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { ADMIN_ROUTES } from '@/constants/routes';

export type AuthError = { message: string; code?: string };
export type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthError };

export const signInWithGoogle = async (
  redirectPath?: string,
): Promise<AuthResult<{ url: string }>> => {
  try {
    if (!isSupabaseConfigured()) {
      return {
        data: null,
        error: {
          message:
            'Supabase is not configured. Add credentials to .env and restart the dev server.',
        },
      };
    }

    const supabase = getSupabase();
    const origin = window.location.origin;
    const next = redirectPath?.startsWith('/') ? redirectPath : ADMIN_ROUTES.dashboard;
    const redirectTo = `${origin}/admin/auth/callback?next=${encodeURIComponent(next)}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { prompt: 'select_account' },
      },
    });

    if (error) {
      return { data: null, error: { message: error.message, code: error.code } };
    }

    if (!data.url) {
      return { data: null, error: { message: 'Google sign-in failed to start.' } };
    }

    return { data: { url: data.url }, error: null };
  } catch {
    return { data: null, error: { message: 'Google sign-in failed. Please try again.' } };
  }
};

export const signOut = async (): Promise<AuthResult<{ signedOut: true }>> => {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { data: null, error: { message: error.message, code: error.code } };
  }
  return { data: { signedOut: true }, error: null };
};

export const getProfile = async (userId: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  return { profile: data, error };
};
