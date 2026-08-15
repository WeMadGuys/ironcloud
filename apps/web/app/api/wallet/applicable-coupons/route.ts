import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { listClaimedCouponIds, resolveUserPhoneDigits } from '@ironcloud/api/benefit-identity';
import { getPendingRefereeOffer } from '@/lib/referrals';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';
import {
  isListedWalletCoupon,
  offerLabel,
  type CustomerTargetContext,
  type WalletCouponRow,
} from '@/lib/wallet-coupons';

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

async function resolveCustomerTarget(
  admin: AdminClient,
  customerId: string,
): Promise<CustomerTargetContext> {
  const { data: address } = await admin
    .from('addresses')
    .select('community_id')
    .eq('customer_id', customerId)
    .eq('is_default', true)
    .maybeSingle();

  let communityId = (address as { community_id: string } | null)?.community_id ?? null;

  if (!communityId) {
    const { data: anyAddress } = await admin
      .from('addresses')
      .select('community_id')
      .eq('customer_id', customerId)
      .limit(1)
      .maybeSingle();
    communityId = (anyAddress as { community_id: string } | null)?.community_id ?? null;
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

/** List wallet coupons for the user (community/city/validity). Amount is not required. */
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

    const target = await resolveCustomerTarget(admin, user.id);

    const [couponsResult, referralOffer, phoneDigits] = await Promise.all([
      admin
        .from('coupons')
        .select(
          'id, code, discount_type, discount_value, max_discount, usage_limit, used_count, valid_from, valid_to, community_ids, applicable_on, cities, min_amount',
        )
        .contains('applicable_on', ['wallet_topup'])
        .order('created_at', { ascending: false }),
      getPendingRefereeOffer(admin, user.id),
      resolveUserPhoneDigits(admin, user.id),
    ]);

    const { data: coupons, error } = couponsResult;
    if (error) return json({ error: error.message }, 500);

    const rows = (coupons ?? []) as WalletCouponRow[];
    const ids = rows.map((c) => c.id);

    const redeemed = new Set<string>();
    if (ids.length > 0) {
      const [{ data: redemptions }, phoneClaimed] = await Promise.all([
        admin
          .from('coupon_redemptions')
          .select('coupon_id')
          .eq('customer_id', user.id)
          .eq('context', 'wallet_topup')
          .in('coupon_id', ids),
        phoneDigits
          ? listClaimedCouponIds(admin, phoneDigits, ids)
          : Promise.resolve(new Set<string>()),
      ]);

      for (const r of (redemptions ?? []) as { coupon_id: string }[]) {
        redeemed.add(r.coupon_id);
      }
      for (const couponId of phoneClaimed) {
        redeemed.add(couponId);
      }
    }

    const listed = rows
      .filter((c) => isListedWalletCoupon(c, target, redeemed.has(c.id)))
      .map((c) => ({
        id: c.id,
        code: c.code,
        discountType: c.discount_type,
        discountValue: Number(c.discount_value),
        maxDiscount: c.max_discount != null ? Number(c.max_discount) : null,
        minAmount: c.min_amount != null ? Number(c.min_amount) : null,
        label: offerLabel(c),
      }));

    return json({ coupons: listed, referralOffer, target });
  } catch (err) {
    console.error('[wallet/applicable-coupons]', err);
    return json({ error: 'Unexpected server error.' }, 500);
  }
}
