import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { applyReferralAtSignup } from '@/lib/referrals';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';
import type { CustomerTargetContext } from '@/lib/wallet-coupons';

type AdminClient = SupabaseClient<any>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: corsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const bearerToken = (req: Request): string | null => {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
};

async function resolveCustomerTarget(
  admin: AdminClient,
  customerId: string,
  communityIdFromBody: string | null,
): Promise<CustomerTargetContext> {
  let communityId = communityIdFromBody;

  if (!communityId) {
    const { data: address } = await admin
      .from('addresses')
      .select('community_id')
      .eq('customer_id', customerId)
      .eq('is_default', true)
      .maybeSingle();
    communityId =
      (address as { community_id: string } | null)?.community_id ?? null;
  }

  if (!communityId) return { communityId: null, city: null };

  const { data: community } = await admin
    .from('communities')
    .select('city')
    .eq('id', communityId)
    .maybeSingle();

  return {
    communityId,
    city: (community as { city: string } | null)?.city ?? null,
  };
}

/** Apply referral code at onboarding only. */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

    let body: { code?: string; communityId?: string | null };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const code = body.code?.trim() ?? '';
    if (!code) return json({ error: 'Referral code is required.' }, 400);

    const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length) {
      return json({ error: `Missing env: ${missing.join(', ')}` }, 500);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) return json({ error: 'Invalid session.' }, 401);

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as AdminClient;

    const target = await resolveCustomerTarget(
      admin,
      user.id,
      body.communityId ?? null,
    );
    const result = await applyReferralAtSignup(admin, user.id, code, target);

    if (!result.ok) {
      return json({ success: false, error: result.message }, 400);
    }

    return json({ success: true, attributionId: result.attributionId });
  } catch (err) {
    console.error('[referrals/apply]', err);
    return json({ error: 'Unexpected server error.' }, 500);
  }
}
