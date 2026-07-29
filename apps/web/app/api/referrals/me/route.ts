import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import {
  buildShareMessage,
  ensureReferralCode,
  getActiveReferralProgram,
  type ReferralProgramRow,
} from '@/lib/referrals';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';
import type { CustomerTargetContext } from '@/lib/wallet-coupons';

type AdminClient = SupabaseClient<any>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

/** One round-trip for default address + community city. */
async function resolveCustomerTarget(
  admin: AdminClient,
  customerId: string,
): Promise<CustomerTargetContext> {
  const { data: address } = await admin
    .from('addresses')
    .select('community_id, community:community_id (city)')
    .eq('customer_id', customerId)
    .eq('is_default', true)
    .maybeSingle();

  type AddrRow = {
    community_id: string | null;
    community: { city: string } | { city: string }[] | null;
  };

  let row = address as AddrRow | null;

  if (!row?.community_id) {
    const { data: anyAddress } = await admin
      .from('addresses')
      .select('community_id, community:community_id (city)')
      .eq('customer_id', customerId)
      .limit(1)
      .maybeSingle();
    row = anyAddress as AddrRow | null;
  }

  if (!row?.community_id) return { communityId: null, city: null };

  const community = Array.isArray(row.community)
    ? row.community[0]
    : row.community;

  return {
    communityId: row.community_id,
    city: community?.city ?? null,
  };
}

function maskName(fullName: string | null): string {
  const name = fullName?.trim();
  if (!name) return 'Friend';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return `${parts[0].slice(0, 1)}***`;
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`;
}

type NestedOne<T> = T | T[] | null;

const asOne = <T,>(value: NestedOne<T>): T | null => {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
};

async function loadProgramForUser(
  admin: AdminClient,
  userId: string,
): Promise<ReferralProgramRow | null> {
  const target = await resolveCustomerTarget(admin, userId);
  return getActiveReferralProgram(admin, target);
}

/** Current user's referral code, program summary, and referral history. */
export async function GET(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

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

    // Parallelize independent work — biggest latency win for production.
    const [program, code, attributionsResult] = await Promise.all([
      loadProgramForUser(admin, user.id),
      ensureReferralCode(admin, user.id),
      admin
        .from('referral_attributions')
        .select(
          `
          id,
          status,
          referral_code,
          qualifying_topup_amount,
          rewarded_at,
          created_at,
          program:program_id (referrer_reward_amount),
          referee:referee_id (full_name)
        `,
        )
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const rows = (attributionsResult.data ?? []) as unknown as Array<{
      id: string;
      status: string;
      referral_code: string;
      qualifying_topup_amount: number | null;
      rewarded_at: string | null;
      created_at: string;
      program: NestedOne<{ referrer_reward_amount: number }>;
      referee: NestedOne<{ full_name: string | null }>;
    }>;

    let pendingCount = 0;
    let rewardedCount = 0;
    let earnedAmount = 0;

    const referrals = rows.map((row) => {
      const programRow = asOne(row.program);
      const refereeRow = asOne(row.referee);
      const reward = Number(programRow?.referrer_reward_amount ?? 0);
      if (row.status === 'pending') pendingCount += 1;
      if (row.status === 'rewarded') {
        rewardedCount += 1;
        earnedAmount += reward;
      }
      return {
        id: row.id,
        status: row.status,
        friendName: maskName(refereeRow?.full_name ?? null),
        createdAt: row.created_at,
        rewardedAt: row.rewarded_at,
        rewardAmount: reward,
      };
    });

    return json(
      {
        code,
        program: program
          ? {
              id: program.id,
              name: program.name,
              referrerReward: Number(program.referrer_reward_amount),
              refereeReward: Number(program.referee_reward_amount),
              minTopup: Number(program.min_referee_topup_amount),
              shareMessage: buildShareMessage(program, code),
            }
          : null,
        stats: {
          totalReferred: referrals.length,
          pending: pendingCount,
          rewarded: rewardedCount,
          earnedAmount: Math.round(earnedAmount * 100) / 100,
        },
        referrals,
      },
      200,
    );
  } catch (err) {
    console.error('[referrals/me]', err);
    return json({ error: 'Unexpected server error.' }, 500);
  }
}
