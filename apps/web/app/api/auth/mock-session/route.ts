import { createServerClient } from '@supabase/ssr';
import { createClient, type AuthError, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getServerSupabaseEnv } from '@/lib/server-env';

const isMockAuthEnabled = () =>
  process.env.NODE_ENV === 'development' &&
  (process.env.NEXT_PUBLIC_AUTH_PROVIDER ?? 'mock') === 'mock';

const phoneDigits = (phone: string) => {
  const formatted = phone.startsWith('+') ? phone : `+91${phone}`;
  return formatted.replace(/\D/g, '').slice(-10);
};


const formatError = (err: unknown): string => {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;

  if (typeof err === 'object') {
    const authErr = err as AuthError & {
      msg?: string;
      error_description?: string;
      cause?: unknown;
      status?: number;
    };

    if (authErr.cause) {
      const nested = formatError(authErr.cause);
      if (nested !== 'Unknown error') return nested;
    }

    if (authErr.message && authErr.message !== '{}') return authErr.message;
    if (authErr.msg) return authErr.msg;
    if (authErr.error_description) return authErr.error_description;
    if (authErr.code) return `Auth error (${authErr.code})`;
    if (authErr.status) return `Auth request failed (HTTP ${authErr.status})`;
  }

  if (err instanceof Error && err.message && err.message !== '{}') {
    return err.message;
  }

  return 'Dev login failed. Enable Phone auth in Supabase and confirm service_role key.';
};

const createDevUser = async (
  admin: ReturnType<typeof createClient>,
  profileId: string,
  digits: string,
) => {
  const devEmail = `admin.${digits}@ironcloud.dev`;

  return admin.auth.admin.createUser({
    id: profileId,
    email: devEmail,
    email_confirm: true,
    user_metadata: { phone: digits },
  });
};

/** Resolve or create the GoTrue user for this dev phone login. */
const ensureAuthUser = async (
  admin: ReturnType<typeof createClient>,
  profileId: string,
  digits: string,
): Promise<User> => {
  const devEmail = `admin.${digits}@ironcloud.dev`;

  const existingByEmail = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: devEmail,
  });
  if (existingByEmail.data?.user) {
    return existingByEmail.data.user;
  }

  const existingById = await admin.auth.admin.getUserById(profileId);
  if (existingById.data.user) {
    return existingById.data.user;
  }

  let created = await createDevUser(admin, profileId, digits);
  if (created.data.user) return created.data.user;

  await admin.auth.admin.deleteUser(profileId).catch(() => undefined);
  created = await createDevUser(admin, profileId, digits);
  if (created.data.user) return created.data.user;

  const retryByEmail = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: devEmail,
  });
  if (retryByEmail.data?.user) {
    return retryByEmail.data.user;
  }

  const withoutId = await admin.auth.admin.createUser({
    email: devEmail,
    email_confirm: true,
    user_metadata: { phone: digits },
  });
  if (withoutId.data.user) return withoutId.data.user;

  throw withoutId.error ?? created.error ?? new Error('Failed to provision auth user.');
};

export async function POST(request: Request) {
  try {
    if (!isMockAuthEnabled()) {
      return NextResponse.json({ error: 'Mock auth is disabled.' }, { status: 403 });
    }

    const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length > 0) {
      const hint =
        missing.includes('SUPABASE_SERVICE_ROLE_KEY')
          ? 'Add SUPABASE_SERVICE_ROLE_KEY to your repo root .env (Supabase Dashboard → Settings → API → service_role secret). Restart npm run web:dev after saving.'
          : `Add to repo root .env: ${missing.join(', ')}`;
      return NextResponse.json({ error: hint, missing }, { status: 500 });
    }

    let body: { phone?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const phone = body.phone?.trim();
    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: 'Valid phone number required.' }, { status: 400 });
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const digits = phoneDigits(phone);
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, full_name')
      .eq('phone', digits)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: `No profile for phone ${digits}. Run docs/admin-portal-seed-data.sql first.` },
        { status: 404 },
      );
    }

    const authUser = await ensureAuthUser(admin, profile.id, digits);

    if (authUser.id !== profile.id) {
      // Free the phone on the seed profile row, then attach it to the live auth user
      await admin
        .from('profiles')
        .update({ phone: `seed-${profile.id.replace(/-/g, '').slice(0, 12)}` })
        .eq('id', profile.id);

      const { error: upsertProfileError } = await admin.from('profiles').upsert({
        id: authUser.id,
        role: profile.role,
        full_name: profile.full_name ?? 'Admin User',
        phone: digits,
      });

      if (upsertProfileError) {
        return NextResponse.json({ error: upsertProfileError.message }, { status: 500 });
      }
    } else if (profile.role !== 'ops_admin' && profile.role !== 'super_admin') {
      await admin.from('profiles').update({ role: 'ops_admin' }).eq('id', authUser.id);
    }

    let email = authUser.email ?? `admin.${digits}@ironcloud.dev`;
    if (!authUser.email) {
      const { error: updateError } = await admin.auth.admin.updateUserById(authUser.id, {
        email,
        email_confirm: true,
      });
      if (updateError) {
        return NextResponse.json({ error: formatError(updateError) }, { status: 500 });
      }
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      return NextResponse.json(
        { error: formatError(linkError) || 'Failed to generate dev session token.' },
        { status: 500 },
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });

    if (verifyError || !sessionData.user || !sessionData.session) {
      return NextResponse.json(
        { error: formatError(verifyError) || 'Failed to establish session.' },
        { status: 500 },
      );
    }

    // Return tokens so the browser client can setSession (localStorage).
    // Cookies alone are enough for middleware, but tRPC reads access_token from
    // the browser Supabase client — which does not use those cookies.
    return NextResponse.json({
      success: true,
      userId: sessionData.user.id,
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    });
  } catch (err) {
    console.error('[mock-session]', err);
    return NextResponse.json({ error: formatError(err) }, { status: 500 });
  }
}
