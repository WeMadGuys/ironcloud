import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { cookies } from 'next/headers';

import { appRouter, createContext } from '@ironcloud/api';
import type { UserRole } from '@ironcloud/db';

import { getServerSupabaseEnv } from '@/lib/server-env';

const loadRole = async (
  userId: string,
  url: string,
  serviceRoleKey: string,
): Promise<UserRole | null> => {
  if (!serviceRoleKey) return null;
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return (profile?.role as UserRole) ?? null;
};

const handler = async (req: Request) => {
  const { url, anonKey, serviceRoleKey } = getServerSupabaseEnv();
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim();

  let userId: string | null = null;
  let userRole: UserRole | null = null;

  if (url && anonKey) {
    if (token) {
      const authClient = createClient(url, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await authClient.auth.getUser(token);
      if (data.user) {
        userId = data.user.id;
      }
    }

    // Fallback: cookie session from mock-login / middleware
    if (!userId) {
      const cookieStore = await cookies();
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Session refresh cookies are not required for this lookup
          },
        },
      });
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        userId = data.user.id;
      }
    }

    if (userId) {
      userRole = await loadRole(userId, url, serviceRoleKey);
    }
  }

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ userId, userRole }),
  });
};

export { handler as GET, handler as POST };
