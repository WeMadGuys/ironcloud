import { getApiBaseUrl } from '../../../lib/api';
import { isExpoGo } from '../../../lib/expo-go';
import { supabase } from '../../../lib/supabase';
import { createTtlCache } from '../../../lib/ttl-cache';
import { fetchUserProfile } from '../../profile/services/profile.service';
import { openRazorpayCheckout } from './razorpay-checkout';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_CACHE_TTL_MS = 30_000;

export type WalletTransaction = {
  id: string;
  type: 'recharge' | 'debit' | 'refund' | 'cashback' | 'expiry';
  amount: number;
  balanceAfter: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

export type WalletInfo = {
  id: string;
  balance: number;
};

export type ApplicableWalletCoupon = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minAmount: number | null;
  label: string;
};

const walletCache = createTtlCache<WalletInfo>(WALLET_CACHE_TTL_MS);
let walletInflight: Promise<WalletInfo | null> | null = null;

export function getCachedWallet(): WalletInfo | null {
  return walletCache.get();
}

export function clearWalletCache(): void {
  walletCache.clear();
  walletInflight = null;
}

export function calcClientWalletBonus(
  coupon: ApplicableWalletCoupon,
  amount: number,
): number {
  if (coupon.discountType === 'flat') {
    return Math.max(0, Number(coupon.discountValue) || 0);
  }
  const raw = (amount * Number(coupon.discountValue)) / 100;
  const capped =
    coupon.maxDiscount != null ? Math.min(raw, Number(coupon.maxDiscount)) : raw;
  return Math.max(0, Math.round(capped * 100) / 100);
}

export function canApplyWalletCoupon(
  coupon: ApplicableWalletCoupon,
  amount: number,
): boolean {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (coupon.minAmount == null) return true;
  return amount >= Number(coupon.minAmount);
}

async function getCurrentUserId(): Promise<string | null> {
  if (IS_MOCK_AUTH) return MOCK_USER_ID;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) return sessionData.session.user.id;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function getAccessToken(): Promise<string | null> {
  if (IS_MOCK_AUTH) {
    // Mock mode still needs a real session token for API routes when available.
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function fetchWalletUncached(): Promise<WalletInfo | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await (supabase
    .from('wallets') as ReturnType<typeof supabase.from>)
    .select('id, balance')
    .eq('customer_id', userId)
    .single();

  if (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }

  return {
    id: (data as { id: string }).id,
    balance: Number((data as { balance: number }).balance),
  };
}

export async function getWallet(options?: {
  force?: boolean;
}): Promise<WalletInfo | null> {
  if (!options?.force) {
    const cached = walletCache.get();
    if (cached) return cached;
    if (walletInflight) return walletInflight;
  }

  walletInflight = (async () => {
    const wallet = await fetchWalletUncached();
    if (wallet) walletCache.set(wallet);
    return wallet;
  })();

  try {
    return await walletInflight;
  } finally {
    walletInflight = null;
  }
}

export async function getWalletTransactions(
  limit = 20,
  options?: { walletId?: string },
): Promise<WalletTransaction[]> {
  let walletId = options?.walletId;
  if (!walletId) {
    const wallet = await getWallet();
    walletId = wallet?.id;
  }
  if (!walletId) return [];

  const { data, error } = await (supabase
    .from('wallet_transactions') as ReturnType<typeof supabase.from>)
    .select('id, type, amount, balance_after, description, order_id, created_at')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return ((data as Array<{
    id: string;
    type: WalletTransaction['type'];
    amount: number;
    balance_after: number;
    description: string | null;
    order_id: string | null;
    created_at: string;
  }>) || []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Math.abs(Number(tx.amount)),
    balanceAfter: Number(tx.balance_after),
    description: tx.description,
    orderId: tx.order_id,
    createdAt: tx.created_at,
  }));
}

export async function listApplicableWalletCoupons(): Promise<ApplicableWalletCoupon[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to view coupons.');
  }

  const apiBase = getApiBaseUrl();
  const response = await fetch(`${apiBase}/api/wallet/applicable-coupons`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = (await response.json().catch(() => ({}))) as {
    coupons?: ApplicableWalletCoupon[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || 'Could not load coupons.');
  }

  return payload.coupons ?? [];
}

export async function topUpWallet(params: {
  amount: number;
  couponCode?: string | null;
}): Promise<{ balance: number; bonus: number; creditTotal: number }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to add money.');
  }

  const apiBase = getApiBaseUrl();

  // Expo Go has no native Razorpay module — use dev stub top-up instead.
  if (isExpoGo()) {
    const response = await fetch(`${apiBase}/api/wallet/top-up`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amount,
        couponCode: params.couponCode ?? null,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      balance?: number;
      bonus?: number;
      creditTotal?: number;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || 'Top-up failed.');
    }

    clearWalletCache();
    return {
      balance: Number(payload.balance ?? 0),
      bonus: Number(payload.bonus ?? 0),
      creditTotal: Number(payload.creditTotal ?? params.amount),
    };
  }

  const orderResponse = await fetch(`${apiBase}/api/payments/razorpay/create-order`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: params.amount,
      couponCode: params.couponCode ?? null,
    }),
  });

  const orderPayload = (await orderResponse.json().catch(() => ({}))) as {
    orderId?: string;
    keyId?: string;
    amountPaise?: number;
    currency?: string;
    amount?: number;
    error?: string;
  };

  if (!orderResponse.ok) {
    throw new Error(orderPayload.error || 'Could not start payment.');
  }

  if (!orderPayload.orderId || !orderPayload.keyId || !orderPayload.amountPaise) {
    throw new Error('Invalid payment order response.');
  }

  const profile = await fetchUserProfile();

  let checkoutResult;
  try {
    checkoutResult = await openRazorpayCheckout({
      keyId: orderPayload.keyId,
      orderId: orderPayload.orderId,
      amountPaise: orderPayload.amountPaise,
      currency: orderPayload.currency ?? 'INR',
      description: 'IronCloud wallet top-up',
      prefill: {
        name: profile?.fullName,
        email: profile?.email ?? undefined,
        contact: profile?.phone,
      },
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 0 || code === 2) {
      throw new Error('Payment cancelled.');
    }
    const message = err instanceof Error ? err.message : 'Payment failed.';
    throw new Error(message);
  }

  const verifyResponse = await fetch(`${apiBase}/api/payments/razorpay/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      razorpayOrderId: checkoutResult.razorpayOrderId,
      razorpayPaymentId: checkoutResult.razorpayPaymentId,
      razorpaySignature: checkoutResult.razorpaySignature,
    }),
  });

  const verifyPayload = (await verifyResponse.json().catch(() => ({}))) as {
    balance?: number;
    bonus?: number;
    creditTotal?: number;
    error?: string;
  };

  if (!verifyResponse.ok) {
    throw new Error(verifyPayload.error || 'Payment verification failed.');
  }

  clearWalletCache();
  return {
    balance: Number(verifyPayload.balance ?? 0),
    bonus: Number(verifyPayload.bonus ?? 0),
    creditTotal: Number(verifyPayload.creditTotal ?? params.amount),
  };
}

export function formatTransactionDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
}
