import type { SupabaseClient } from '@supabase/supabase-js';

import {
  BENEFIT_TYPE_COUPON,
  hasBenefitClaim,
  insertBenefitClaim,
  resolveUserPhoneDigits,
} from '@ironcloud/api/benefit-identity';
import { maybeRewardReferral } from '@/lib/referrals';
import {
  calcWalletBonus,
  isEligibleWalletCoupon,
  type CustomerTargetContext,
  type WalletCouponRow,
} from '@/lib/wallet-coupons';

type AdminClient = SupabaseClient<any>;

export type WalletTopUpResult = {
  amount: number;
  bonus: number;
  creditTotal: number;
  balance: number;
  couponCode: string | null;
  referral: { rewarded: boolean; referrerBonus: number; refereeBonus: number };
  rechargeTxnId: string;
};

export async function resolveCustomerTarget(
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

export async function resolveWalletCoupon(
  admin: AdminClient,
  customerId: string,
  amount: number,
  couponCode: string | null,
): Promise<{ bonus: number; coupon: WalletCouponRow | null; error?: string }> {
  if (!couponCode) return { bonus: 0, coupon: null };

  const target = await resolveCustomerTarget(admin, customerId);
  const { data: couponRow, error: couponError } = await admin
    .from('coupons')
    .select(
      'id, code, discount_type, discount_value, max_discount, usage_limit, used_count, valid_from, valid_to, community_ids, applicable_on, cities, min_amount',
    )
    .eq('code', couponCode)
    .maybeSingle();

  if (couponError || !couponRow) {
    return { bonus: 0, coupon: null, error: 'Coupon not found.' };
  }

  const coupon = couponRow as WalletCouponRow;

  const { data: existingRedeem } = await admin
    .from('coupon_redemptions')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('customer_id', customerId)
    .eq('context', 'wallet_topup')
    .maybeSingle();

  const phoneDigits = await resolveUserPhoneDigits(admin, customerId);
  const phoneClaimed =
    phoneDigits != null &&
    (await hasBenefitClaim(admin, phoneDigits, BENEFIT_TYPE_COUPON, coupon.id));

  if (
    !isEligibleWalletCoupon(
      coupon,
      amount,
      target,
      Boolean(existingRedeem) || phoneClaimed,
    )
  ) {
    return { bonus: 0, coupon: null, error: 'Coupon is not applicable for this top-up.' };
  }

  return { bonus: calcWalletBonus(coupon, amount), coupon };
}

export async function isRazorpayPaymentCredited(
  admin: AdminClient,
  razorpayPaymentId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('wallet_transactions')
    .select('id')
    .eq('razorpay_payment_id', razorpayPaymentId)
    .maybeSingle();

  return Boolean(data);
}

export async function creditWalletTopUp(params: {
  admin: AdminClient;
  customerId: string;
  amount: number;
  couponCode: string | null;
  razorpayPaymentId: string;
}): Promise<WalletTopUpResult> {
  const { admin, customerId, amount, couponCode, razorpayPaymentId } = params;

  if (await isRazorpayPaymentCredited(admin, razorpayPaymentId)) {
    const { data: wallet } = await admin
      .from('wallets')
      .select('balance')
      .eq('customer_id', customerId)
      .single();

    return {
      amount,
      bonus: 0,
      creditTotal: amount,
      balance: Number((wallet as { balance: number } | null)?.balance ?? 0),
      couponCode: couponCode,
      referral: { rewarded: false, referrerBonus: 0, refereeBonus: 0 },
      rechargeTxnId: '',
    };
  }

  const { data: wallet, error: walletError } = await admin
    .from('wallets')
    .select('id, balance')
    .eq('customer_id', customerId)
    .single();

  if (walletError || !wallet) {
    throw new Error('Wallet not found.');
  }

  const couponResolution = await resolveWalletCoupon(admin, customerId, amount, couponCode);
  if (couponResolution.error) {
    throw new Error(couponResolution.error);
  }

  const { bonus, coupon } = couponResolution;

  let balance = Number((wallet as { balance: number }).balance);
  balance = Math.round((balance + amount) * 100) / 100;

  const { data: rechargeTxn, error: rechargeError } = await admin
    .from('wallet_transactions')
    .insert({
      wallet_id: (wallet as { id: string }).id,
      type: 'recharge',
      amount,
      balance_after: balance,
      razorpay_payment_id: razorpayPaymentId,
      description: coupon ? `Wallet top-up (coupon ${coupon.code})` : 'Wallet top-up',
    })
    .select('id')
    .single();

  if (rechargeError || !rechargeTxn) {
    throw new Error(rechargeError?.message || 'Failed to credit wallet.');
  }

  let cashbackTxnId: string | null = null;
  if (bonus > 0 && coupon) {
    balance = Math.round((balance + bonus) * 100) / 100;
    const { data: cashbackTxn, error: cashbackError } = await admin
      .from('wallet_transactions')
      .insert({
        wallet_id: (wallet as { id: string }).id,
        type: 'cashback',
        amount: bonus,
        balance_after: balance,
        description: `Coupon bonus (${coupon.code})`,
      })
      .select('id')
      .single();

    if (cashbackError || !cashbackTxn) {
      throw new Error(cashbackError?.message || 'Failed to credit bonus.');
    }
    cashbackTxnId = (cashbackTxn as { id: string }).id;
  }

  const { error: walletUpdateError } = await admin
    .from('wallets')
    .update({ balance, updated_at: new Date().toISOString() })
    .eq('id', (wallet as { id: string }).id);

  if (walletUpdateError) {
    throw new Error(walletUpdateError.message);
  }

  if (coupon) {
    const { error: redeemError } = await admin.from('coupon_redemptions').insert({
      coupon_id: coupon.id,
      customer_id: customerId,
      context: 'wallet_topup',
      wallet_transaction_id: cashbackTxnId ?? (rechargeTxn as { id: string }).id,
      topup_amount: amount,
      bonus_amount: bonus,
    });

    if (redeemError) {
      throw new Error(redeemError.message);
    }

    const phoneDigits = await resolveUserPhoneDigits(admin, customerId);
    if (phoneDigits) {
      await insertBenefitClaim(admin, {
        phoneDigits,
        benefitType: BENEFIT_TYPE_COUPON,
        benefitId: coupon.id,
        claimedBy: customerId,
      }).catch((claimErr) => {
        console.error('[wallet-topup] Failed to persist coupon identity claim', claimErr);
      });
    }

    await admin
      .from('coupons')
      .update({ used_count: Number(coupon.used_count) + 1 })
      .eq('id', coupon.id);
  }

  let referral = { rewarded: false, referrerBonus: 0, refereeBonus: 0 };
  try {
    referral = await maybeRewardReferral(
      admin,
      customerId,
      amount,
      (rechargeTxn as { id: string }).id,
    );
    if (referral.rewarded && referral.refereeBonus > 0) {
      const { data: refreshed } = await admin
        .from('wallets')
        .select('balance')
        .eq('customer_id', customerId)
        .single();
      if (refreshed) {
        balance = Number((refreshed as { balance: number }).balance);
      }
    }
  } catch (referralErr) {
    console.error('[wallet-topup] referral reward failed', referralErr);
  }

  return {
    amount,
    bonus,
    creditTotal: Math.round((amount + bonus) * 100) / 100,
    balance,
    couponCode: coupon?.code ?? null,
    referral,
    rechargeTxnId: (rechargeTxn as { id: string }).id,
  };
}
