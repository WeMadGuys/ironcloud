import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { resolvePickupRiderForCommunity } from '@/lib/resolve-pickup-rider';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

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

/**
 * Resolve which rider should pick up for a community.
 * Uses service role (customer clients cannot read rider_communities under RLS).
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: { communityId?: string };
    try {
      body = (await req.json()) as { communityId?: string };
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const communityId = body.communityId?.trim();
    if (!communityId) {
      return json({ error: 'communityId is required.' }, 400);
    }

    const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length > 0) {
      return json(
        {
          error: `Server misconfigured. Missing: ${missing.join(', ')}`,
        },
        500,
      );
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }

    const admin: AdminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: address, error: addressError } = await admin
      .from('addresses')
      .select('id')
      .eq('customer_id', user.id)
      .eq('community_id', communityId)
      .limit(1)
      .maybeSingle();

    if (addressError) {
      return json({ error: addressError.message }, 500);
    }
    if (!address) {
      return json(
        { error: 'You do not have an address in this community.' },
        403,
      );
    }

    const resolved = await resolvePickupRiderForCommunity(admin, communityId);
    if ('error' in resolved) {
      return json({ error: resolved.error }, resolved.status);
    }

    return json({
      success: true,
      riderId: resolved.riderId,
      riderName: resolved.riderName,
      riderPhone: resolved.riderPhone,
    });
  } catch (err) {
    console.error('[resolve-pickup-rider]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Failed to resolve pickup rider.' },
      500,
    );
  }
}
