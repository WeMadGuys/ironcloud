import { NextResponse } from 'next/server';

import { authenticateMobileRequest, mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { creditWalletTopUp } from '@/lib/wallet-topup';
import { ensureServerEnv } from '@/lib/server-env';
import crypto from 'node:crypto';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: mobileApiCorsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}

function isDevWalletTopUpAllowed(): boolean {
  // Hard block on hosted production even if the env flag is mis-set.
  if (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  ) {
    return false;
  }
  return process.env.ALLOW_DEV_WALLET_TOPUP === 'true';
}

/**
 * Dev-only direct wallet credit for Expo Go testing (no Razorpay).
 * Set ALLOW_DEV_WALLET_TOPUP=true in local server env only.
 * Never available when VERCEL_ENV/NODE_ENV is production.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  if (!isDevWalletTopUpAllowed()) {
    return json(
      {
        error:
          'Direct wallet top-up is disabled. Complete payment via Razorpay checkout first.',
      },
      400,
    );
  }

  const auth = await authenticateMobileRequest(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { user, admin } = auth.ctx;

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

  try {
    const result = await creditWalletTopUp({
      admin,
      customerId: user.id,
      amount,
      couponCode,
      razorpayPaymentId: `dev_expo_go_${crypto.randomUUID()}`,
    });

    return json({
      success: true,
      devBypass: true,
      ...result,
    });
  } catch (err) {
    console.error('[wallet/top-up]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Top-up failed.' },
      400,
    );
  }
}
