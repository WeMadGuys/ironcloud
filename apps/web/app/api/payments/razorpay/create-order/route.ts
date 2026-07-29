import { NextResponse } from 'next/server';

import { authenticateMobileRequest, mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { getRazorpayClient, getRazorpayEnv } from '@/lib/razorpay';
import { resolveWalletCoupon } from '@/lib/wallet-topup';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: mobileApiCorsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}

export async function POST(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { user, admin } = auth.ctx;

  const razorpayEnv = getRazorpayEnv();
  if (razorpayEnv.missing.length) {
    return json({ error: `Missing env: ${razorpayEnv.missing.join(', ')}` }, 500);
  }

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

  const { data: wallet, error: walletError } = await admin
    .from('wallets')
    .select('id')
    .eq('customer_id', user.id)
    .single();

  if (walletError || !wallet) {
    return json({ error: 'Wallet not found.' }, 404);
  }

  const couponResolution = await resolveWalletCoupon(admin, user.id, amount, couponCode);
  if (couponResolution.error) {
    return json({ error: couponResolution.error }, 400);
  }

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      notes: {
        purpose: 'wallet_topup',
        customer_id: user.id,
        wallet_id: (wallet as { id: string }).id,
        coupon_code: couponCode ?? '',
      },
    });

    return json({
      orderId: order.id,
      amount,
      amountPaise: order.amount,
      currency: order.currency,
      keyId: razorpayEnv.keyId,
      couponCode,
      bonus: couponResolution.bonus,
      creditTotal: Math.round((amount + couponResolution.bonus) * 100) / 100,
    });
  } catch (err) {
    console.error('[razorpay/create-order]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Could not create payment order.' },
      502,
    );
  }
}
