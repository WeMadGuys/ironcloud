import { NextResponse } from 'next/server';

import {
  authenticateMobileRequest,
  mobileApiCorsHeaders,
} from '@/lib/api-mobile-auth';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: mobileApiCorsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}

/**
 * Upsert or remove the signed-in customer's Expo push token.
 * Body: { token, platform?, promotionsEnabled?, remove? }
 * Vercel deploy probe: 2026-08-12T22:04
 */
export async function POST(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  const { user, admin } = auth.ctx;

  let body: {
    token?: string;
    platform?: string;
    promotionsEnabled?: boolean;
    remove?: boolean;
    diagnostic?: boolean;
    stage?: string;
    message?: string;
  } = {};

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  if (body.diagnostic === true) {
    console.warn('[push-client]', {
      userId: user.id,
      stage: typeof body.stage === 'string' ? body.stage : 'unknown',
      message: typeof body.message === 'string' ? body.message.slice(0, 500) : '',
      platform: typeof body.platform === 'string' ? body.platform : null,
    });
    return json({ success: true, diagnostic: true });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return json({ error: 'token is required.' }, 400);
  }

  if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
    return json({ error: 'Invalid Expo push token format.' }, 400);
  }

  if (body.remove === true) {
    const { error } = await admin
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('expo_push_token', token);

    if (error) {
      return json({ error: error.message }, 500);
    }
    return json({ success: true, removed: true });
  }

  const platform =
    typeof body.platform === 'string' && body.platform.trim()
      ? body.platform.trim().toLowerCase()
      : null;
  const promotionsEnabled =
    typeof body.promotionsEnabled === 'boolean' ? body.promotionsEnabled : true;

  const { error } = await admin.from('push_tokens').upsert(
    {
      user_id: user.id,
      expo_push_token: token,
      platform,
      promotions_enabled: promotionsEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'expo_push_token' },
  );

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ success: true });
}
