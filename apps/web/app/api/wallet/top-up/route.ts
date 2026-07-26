import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';
import {
  calcWalletBonus,
  isEligibleWalletCoupon,
  type CustomerTargetContext,
  type WalletCouponRow,
} from '@/lib/wallet-coupons';

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

/**
 * Credit wallet for Add Money.
 * TODO(razorpay): replace stub credit with payment verification, then credit amount + bonus.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

    let body: { amount?: number; couponCode?: string | null };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'amount must be a positive number.' }, 400);
    }
    if (amount > 100000) {
      return json({ error: 'amount exceeds maximum allowed.' }, 400);
    }

    const couponCode = body.couponCode?.trim().toUpperCase() || null;

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

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('id, balance')
      .eq('customer_id', user.id)
      .single();

    if (walletError || !wallet) {
      return json({ error: 'Wallet not found.' }, 404);
    }

    let bonus = 0;
    let coupon: WalletCouponRow | null = null;

    if (couponCode) {
      const target = await resolveCustomerTarget(admin, user.id);
      const { data: couponRow, error: couponError } = await admin
        .from('coupons')
        .select(
          'id, code, discount_type, discount_value, max_discount, usage_limit, used_count, valid_from, valid_to, community_ids, applicable_on, cities, min_amount',
        )
        .eq('code', couponCode)
        .maybeSingle();

      if (couponError || !couponRow) {
        return json({ error: 'Coupon not found.' }, 400);
      }

      coupon = couponRow as WalletCouponRow;

      const { data: existingRedeem } = await admin
        .from('coupon_redemptions')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('customer_id', user.id)
        .eq('context', 'wallet_topup')
        .maybeSingle();

      if (
        !isEligibleWalletCoupon(
          coupon,
          amount,
          target,
          Boolean(existingRedeem),
        )
      ) {
        return json({ error: 'Coupon is not applicable for this top-up.' }, 400);
      }

      bonus = calcWalletBonus(coupon, amount);
    }

    // TODO(razorpay): verify payment for `amount` before crediting.
    let balance = Number(wallet.balance);
    balance = Math.round((balance + amount) * 100) / 100;

    const { data: rechargeTxn, error: rechargeError } = await admin
      .from('wallet_transactions')
      .insert({
        wallet_id: wallet.id,
        type: 'recharge',
        amount,
        balance_after: balance,
        description: coupon
          ? `Wallet top-up (coupon ${coupon.code})`
          : 'Wallet top-up',
      })
      .select('id')
      .single();

    if (rechargeError || !rechargeTxn) {
      return json({ error: rechargeError?.message || 'Failed to credit wallet.' }, 500);
    }

    let cashbackTxnId: string | null = null;
    if (bonus > 0 && coupon) {
      balance = Math.round((balance + bonus) * 100) / 100;
      const { data: cashbackTxn, error: cashbackError } = await admin
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          type: 'cashback',
          amount: bonus,
          balance_after: balance,
          description: `Coupon bonus (${coupon.code})`,
        })
        .select('id')
        .single();

      if (cashbackError || !cashbackTxn) {
        return json({ error: cashbackError?.message || 'Failed to credit bonus.' }, 500);
      }
      cashbackTxnId = cashbackTxn.id;
    }

    const { error: walletUpdateError } = await admin
      .from('wallets')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (walletUpdateError) {
      return json({ error: walletUpdateError.message }, 500);
    }

    if (coupon) {
      const { error: redeemError } = await admin.from('coupon_redemptions').insert({
        coupon_id: coupon.id,
        customer_id: user.id,
        context: 'wallet_topup',
        wallet_transaction_id: cashbackTxnId ?? rechargeTxn.id,
        topup_amount: amount,
        bonus_amount: bonus,
      });

      if (redeemError) {
        // Unique violation => already redeemed
        return json({ error: redeemError.message }, 400);
      }

      await admin
        .from('coupons')
        .update({ used_count: Number(coupon.used_count) + 1 })
        .eq('id', coupon.id);
    }

    return json({
      success: true,
      amount,
      bonus,
      creditTotal: Math.round((amount + bonus) * 100) / 100,
      balance,
      couponCode: coupon?.code ?? null,
    });
  } catch (err) {
    console.error('[wallet/top-up]', err);
    return json({ error: 'Unexpected server error.' }, 500);
  }
}
