import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

export const mobileApiCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Razorpay-Signature',
};

export const bearerToken = (req: Request): string | null => {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
};

export type MobileAuthContext = {
  user: User;
  admin: SupabaseClient<any>;
};

export async function authenticateMobileRequest(
  req: Request,
): Promise<{ ok: true; ctx: MobileAuthContext } | { ok: false; error: string; status: number }> {
  ensureServerEnv();

  const token = bearerToken(req);
  if (!token) {
    return { ok: false, error: 'Missing Authorization bearer token.', status: 401 };
  }

  const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
  if (missing.length) {
    return { ok: false, error: `Missing env: ${missing.join(', ')}`, status: 500 };
  }

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return { ok: false, error: 'Invalid session.', status: 401 };
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as SupabaseClient<any>;

  return { ok: true, ctx: { user, admin } };
}
