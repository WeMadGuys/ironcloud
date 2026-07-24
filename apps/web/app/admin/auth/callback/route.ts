import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { ADMIN_ROUTES } from '@/constants/routes';
import { getServerSupabaseEnv } from '@/lib/server-env';

const loginError = (request: NextRequest, code: string) => {
  const url = request.nextUrl.clone();
  url.pathname = ADMIN_ROUTES.login;
  url.search = '';
  url.searchParams.set('error', code);
  return NextResponse.redirect(url);
};

export const GET = async (request: NextRequest) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? ADMIN_ROUTES.dashboard;
  const nextPath =
    rawNext.startsWith('/admin') && !rawNext.startsWith('//')
      ? rawNext
      : ADMIN_ROUTES.dashboard;

  if (!code) {
    return loginError(request, 'oauth');
  }

  const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
  if (missing.length > 0) {
    return loginError(request, 'config');
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.user) {
    return loginError(request, 'oauth');
  }

  const email = sessionData.user.email?.trim().toLowerCase();
  if (!email) {
    await supabase.auth.signOut();
    return loginError(request, 'unauthorized');
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: allowed, error: allowError } = await admin
    .from('admin_allowed_emails')
    .select('email, role')
    .eq('email', email)
    .maybeSingle();

  if (allowError || !allowed) {
    await supabase.auth.signOut();
    return loginError(request, 'unauthorized');
  }

  const allowedRole = allowed.role === 'super_admin' ? 'super_admin' : 'ops_admin';
  const fullName =
    (typeof sessionData.user.user_metadata?.full_name === 'string'
      ? sessionData.user.user_metadata.full_name
      : null) ??
    (typeof sessionData.user.user_metadata?.name === 'string'
      ? sessionData.user.user_metadata.name
      : null);

  const { data: existing } = await admin
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', sessionData.user.id)
    .maybeSingle();

  const nextRole =
    existing?.role === 'super_admin' ? 'super_admin' : allowedRole;

  const { error: profileError } = await admin.from('profiles').upsert(
    {
      id: sessionData.user.id,
      email,
      role: nextRole,
      full_name: existing?.full_name ?? fullName,
    },
    { onConflict: 'id' },
  );

  if (profileError) {
    console.error('[admin/auth/callback] profile upsert failed', profileError);
    await supabase.auth.signOut();
    return loginError(request, 'oauth');
  }

  const redirectUrl = new URL(nextPath.startsWith('/') ? nextPath : ADMIN_ROUTES.dashboard, origin);
  return NextResponse.redirect(redirectUrl);
};
