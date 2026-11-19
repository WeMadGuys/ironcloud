import { IS_MOCK_AUTH, MOCK_USER_ID } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { isExpoGo } from '../../../lib/expo-go';
import { supabase } from '../../../lib/supabase';
import { createTtlCache } from '../../../lib/ttl-cache';
import { fetchUserProfile } from '../../profile/services/profile.service';
import { openRazorpayCheckout } from './razorpay-checkout';

const WALLET_CACHE_TTL_MS = 30_000;
const COUPONS_CACHE_TTL_MS = 120_000;

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

export type PendingReferralOffer = {
  minTopup: number;
  reward: number;
  label: string;
};

export type ApplicableWalletOffers = {
  coupons: ApplicableWalletCoupon[];
  referralOffer: PendingReferralOffer | null;
};

const walletCache = createTtlCache<WalletInfo>(WALLET_CACHE_TTL_MS);
const couponsCache = createTtlCache<ApplicableWalletOffers>(COUPONS_CACHE_TTL_MS);
let walletInflight: Promise<WalletInfo | null> | null = null;
let walletFetchGeneration = 0;
let lastWalletId: string | null = null;
const walletBalanceListeners = new Set<(balance: number) => void>();

const RECONCILE_ATTEMPTS = 8;
const RECONCILE_DELAY_MS = 1200;

export function getCachedWallet(): WalletInfo | null {
  return walletCache.get();
}

export function subscribeWalletBalance(listener: (balance: number) => void): () => void {
  walletBalanceListeners.add(listener);
  return () => {
    walletBalanceListeners.delete(listener);
  };
}

function notifyWalletBalance(balance: number): void {
  const prev = walletCache.get();
  const walletId = prev?.id ?? lastWalletId;
  if (walletId) {
    lastWalletId = walletId;
    walletCache.set({ id: walletId, balance });
  }
  walletBalanceListeners.forEach((listener) => listener(balance));
}

function applyTopUpSuccess(payload: {
  balance?: number;
  bonus?: number;
  creditTotal?: number;
  amount?: number;
}): { balance: number; bonus: number; creditTotal: number } {
  const balance = Number(payload.balance ?? 0);
  const bonus = Number(payload.bonus ?? 0);
  const creditTotal = Number(payload.creditTotal ?? payload.amount ?? 0);
  walletFetchGeneration += 1;
  couponsCache.clear();
  notifyWalletBalance(balance);
  return { balance, bonus, creditTotal };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function getCachedApplicableWalletOffers(): ApplicableWalletOffers | null {
  return couponsCache.get();
}

export function getCachedApplicableWalletCoupons(): ApplicableWalletCoupon[] | null {
  return couponsCache.get()?.coupons ?? null;
}

export function clearWalletCache(): void {
  walletCache.clear();
  couponsCache.clear();
  walletInflight = null;
  lastWalletId = null;
  walletFetchGeneration += 1;
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

  const wallet = {
    id: (data as { id: string }).id,
    balance: Number((data as { balance: number }).balance),
  };
  lastWalletId = wallet.id;
  return wallet;
}

export async function getWallet(options?: {
  force?: boolean;
}): Promise<WalletInfo | null> {
  if (!options?.force) {
    const cached = walletCache.get();
    if (cached) return cached;
    if (walletInflight) return walletInflight;
  }

  const generation = ++walletFetchGeneration;
  const promise = (async () => {
    const wallet = await fetchWalletUncached();
    if (generation !== walletFetchGeneration) {
      return walletCache.get() ?? wallet;
    }
    if (wallet) {
      walletCache.set(wallet);
      notifyWalletBalance(wallet.balance);
    }
    return wallet;
  })();

  walletInflight = promise;
  try {
    return await promise;
  } finally {
    if (walletInflight === promise) walletInflight = null;
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

function parseReferralOffer(raw: unknown): PendingReferralOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const offer = raw as {
    minTopup?: number;
    reward?: number;
    label?: string;
  };
  const minTopup = Number(offer.minTopup);
  const reward = Number(offer.reward);
  if (!Number.isFinite(minTopup) || minTopup < 0) return null;
  if (!Number.isFinite(reward) || reward <= 0) return null;
  const label =
    typeof offer.label === 'string' && offer.label.trim()
      ? offer.label
      : `Recharge ₹${minTopup}+ to get ₹${reward}`;
  return { minTopup, reward, label };
}

export async function listApplicableWalletCoupons(options?: {
  force?: boolean;
}): Promise<ApplicableWalletOffers> {
  return couponsCache.getOrFetch(async () => {
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
      referralOffer?: PendingReferralOffer | null;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || 'Could not load coupons.');
    }

    return {
      coupons: payload.coupons ?? [],
      referralOffer: parseReferralOffer(payload.referralOffer),
    };
  }, options?.force);
}

type ReconcilePayload = {
  status?: 'credited' | 'pending';
  orderStatus?: string;
  balance?: number;
  bonus?: number;
  creditTotal?: number;
  amount?: number;
  error?: string;
};

async function reconcileRazorpayOrderOnce(
  apiBase: string,
  token: string,
  razorpayOrderId: string,
): Promise<ReconcilePayload> {
  const response = await fetch(`${apiBase}/api/payments/razorpay/reconcile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ razorpayOrderId }),
  });

  const payload = (await response.json().catch(() => ({}))) as ReconcilePayload;
  if (!response.ok) {
    throw new Error(payload.error || 'Could not confirm payment.');
  }
  return payload;
}

async function recoverRazorpayTopUp(
  apiBase: string,
  token: string,
  razorpayOrderId: string,
  fallbackAmount: number,
): Promise<{ balance: number; bonus: number; creditTotal: number } | null> {
  for (let i = 0; i < RECONCILE_ATTEMPTS; i++) {
    if (i > 0) await sleep(RECONCILE_DELAY_MS);
    try {
      const result = await reconcileRazorpayOrderOnce(apiBase, token, razorpayOrderId);
      if (result.status === 'credited') {
        return applyTopUpSuccess({ ...result, amount: fallbackAmount });
      }
    } catch {
      // Payment may still be capturing after UPI returns — keep checking.
    }
  }

  return null;
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

    return applyTopUpSuccess({
      balance: payload.balance,
      bonus: payload.bonus,
      creditTotal: payload.creditTotal,
      amount: params.amount,
    });
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
    const recovered = await recoverRazorpayTopUp(
      apiBase,
      token,
      orderPayload.orderId,
      params.amount,
    );
    if (recovered) return recovered;

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

  if (verifyResponse.ok) {
    return applyTopUpSuccess({
      balance: verifyPayload.balance,
      bonus: verifyPayload.bonus,
      creditTotal: verifyPayload.creditTotal,
      amount: params.amount,
    });
  }

  const recovered = await recoverRazorpayTopUp(
    apiBase,
    token,
    orderPayload.orderId,
    params.amount,
  );
  if (recovered) return recovered;

  throw new Error(verifyPayload.error || 'Payment verification failed.');
}

export function formatTransactionDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
}
