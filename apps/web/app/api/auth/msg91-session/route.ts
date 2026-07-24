import { createClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

// Service-role client is untyped here (same pattern as mock-session).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

const MSG91_VERIFY_URL =
  'https://control.msg91.com/api/v5/widget/verifyAccessToken';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: corsHeaders });

/** Preflight for Expo web (localhost:8081) → Next API (localhost:3001). */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const phoneDigits = (phone: string) => {
  const formatted = phone.startsWith('+') ? phone : `+91${phone}`;
  return formatted.replace(/\D/g, '').slice(-10);
};

const toE164 = (digits: string) => `+91${digits}`;

const customerEmail = (digits: string) => `customer.${digits}@ironcloud.app`;

type Msg91VerifyPayload = {
  type?: string;
  message?: string;
  data?: {
    identifier?: string;
    mobile?: string;
    phone?: string;
    email?: string;
  };
  identifier?: string;
  mobile?: string;
};

const extractIdentifier = (payload: Msg91VerifyPayload): string | null => {
  const candidates = [
    payload.data?.identifier,
    payload.data?.mobile,
    payload.data?.phone,
    payload.identifier,
    payload.mobile,
    // Some MSG91 responses put the verified number in `message` on success
    typeof payload.message === 'string' && /^\d{10,15}$/.test(payload.message)
      ? payload.message
      : null,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.replace(/\D/g, '').length >= 10) {
      return value;
    }
  }
  return null;
};

const verifyMsg91AccessToken = async (
  accessToken: string,
  authkey: string,
): Promise<{ ok: true; digits: string | null } | { ok: false; error: string }> => {
  const response = await fetch(MSG91_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      authkey,
      'access-token': accessToken,
    }),
  });

  let payload: Msg91VerifyPayload;
  try {
    payload = (await response.json()) as Msg91VerifyPayload;
  } catch {
    return { ok: false, error: 'Invalid response from MSG91.' };
  }

  const failed =
    !response.ok ||
    payload.type === 'error' ||
    (typeof payload.message === 'string' &&
      /invalid|fail|expire|unauthor/i.test(payload.message) &&
      !extractIdentifier(payload));

  if (failed) {
    return {
      ok: false,
      error: payload.message || 'MSG91 token verification failed.',
    };
  }

  const identifier = extractIdentifier(payload);
  return {
    ok: true,
    digits: identifier ? phoneDigits(identifier) : null,
  };
};

const ensureCustomerAuthUser = async (
  admin: AdminClient,
  digits: string,
  existingProfileId?: string,
): Promise<{ user: User; isNewUser: boolean }> => {
  const e164 = toE164(digits);
  const email = customerEmail(digits);

  if (existingProfileId) {
    const existing = await admin.auth.admin.getUserById(existingProfileId);
    if (existing.data.user) {
      await admin.auth.admin.updateUserById(existing.data.user.id, {
        phone: e164,
        phone_confirm: true,
        email,
        email_confirm: true,
        user_metadata: {
          ...existing.data.user.user_metadata,
          phone: digits,
          role: 'customer',
        },
      });
      return { user: existing.data.user, isNewUser: false };
    }
  }

  const created = await admin.auth.admin.createUser({
    ...(existingProfileId ? { id: existingProfileId } : {}),
    phone: e164,
    phone_confirm: true,
    email,
    email_confirm: true,
    user_metadata: { phone: digits, role: 'customer' },
  });

  if (created.data.user) {
    await admin
      .from('profiles')
      .update({ phone: digits, role: 'customer' })
      .eq('id', created.data.user.id);

    return { user: created.data.user, isNewUser: !existingProfileId };
  }

  // Phone/email may already exist — resolve via magiclink lookup on synthetic email
  const byEmail = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (byEmail.data?.user) {
    return { user: byEmail.data.user, isNewUser: false };
  }

  throw created.error ?? new Error('Failed to create customer auth user.');
};

const mintSession = async (
  admin: AdminClient,
  user: User,
  digits: string,
) => {
  const email = user.email ?? customerEmail(digits);

  if (!user.email) {
    await admin.auth.admin.updateUserById(user.id, {
      email,
      email_confirm: true,
    });
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    throw linkError ?? new Error('Failed to generate session token.');
  }

  const { url, anonKey } = getServerSupabaseEnv();
  const supabase = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'email',
  });

  if (verifyError || !sessionData.session || !sessionData.user) {
    throw verifyError ?? new Error('Failed to establish session.');
  }

  return {
    userId: sessionData.user.id,
    accessToken: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
  };
};

export async function POST(request: Request) {
  try {
    ensureServerEnv();

    const authkey = process.env.MSG91_AUTHKEY ?? '';
    if (!authkey) {
      return json(
        { error: 'MSG91_AUTHKEY is not configured on the server.' },
        500,
      );
    }

    const { url, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length > 0) {
      return json(
        { error: `Missing server env: ${missing.join(', ')}` },
        500,
      );
    }

    let body: { accessToken?: string; phone?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid request body.' }, 400);
    }

    const accessToken = body.accessToken?.trim();
    if (!accessToken) {
      return json({ error: 'accessToken is required.' }, 400);
    }

    const verified = await verifyMsg91AccessToken(accessToken, authkey);
    if (!verified.ok) {
      return json({ error: verified.error }, 401);
    }

    let digits = verified.digits;

    // Optional client phone must match MSG91-verified number when both present
    if (body.phone) {
      const clientDigits = phoneDigits(body.phone);
      if (digits && clientDigits !== digits) {
        return json(
          { error: 'Phone number does not match verified OTP.' },
          401,
        );
      }
      if (!digits) digits = clientDigits;
    }

    if (!digits || digits.length !== 10) {
      return json(
        { error: 'Could not resolve a verified phone number.' },
        401,
      );
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await admin
      .from('profiles')
      .select('id, role')
      .eq('phone', digits)
      .maybeSingle();

    if (profile && profile.role !== 'customer') {
      return json(
        { error: 'This phone is registered for a different account type.' },
        403,
      );
    }

    const { user, isNewUser } = await ensureCustomerAuthUser(
      admin,
      digits,
      profile?.id,
    );

    // Keep profiles.phone as 10-digit for app queries
    await admin.from('profiles').upsert({
      id: user.id,
      phone: digits,
      role: 'customer',
    });

    const session = await mintSession(admin, user, digits);

    return json({
      success: true,
      isNewUser,
      phone: digits,
      ...session,
    });
  } catch (err) {
    console.error('[msg91-session]', err);
    const message = err instanceof Error ? err.message : 'Session creation failed.';
    return json({ error: message }, 500);
  }
}
