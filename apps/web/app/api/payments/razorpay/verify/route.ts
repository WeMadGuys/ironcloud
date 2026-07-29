import { NextResponse } from 'next/server';

import { authenticateMobileRequest, mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { getRazorpayClient, verifyPaymentSignature } from '@/lib/razorpay';
import { creditWalletTopUp } from '@/lib/wallet-topup';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: mobileApiCorsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}

export async function POST(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { user, admin } = auth.ctx;

  let body: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const razorpayOrderId = body.razorpayOrderId?.trim();
  const razorpayPaymentId = body.razorpayPaymentId?.trim();
  const razorpaySignature = body.razorpaySignature?.trim();

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return json({ error: 'Missing Razorpay payment details.' }, 400);
  }

  if (!verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    return json({ error: 'Invalid payment signature.' }, 400);
  }

  try {
    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(razorpayPaymentId);

    if (payment.status !== 'captured') {
      return json({ error: 'Payment is not completed.' }, 400);
    }
    if (payment.order_id !== razorpayOrderId) {
      return json({ error: 'Payment does not match order.' }, 400);
    }

    const order = await razorpay.orders.fetch(razorpayOrderId);
    const notes = (order.notes ?? {}) as Record<string, string>;
    if (notes.purpose !== 'wallet_topup') {
      return json({ error: 'Invalid payment purpose.' }, 400);
    }
    if (notes.customer_id !== user.id) {
      return json({ error: 'Payment does not belong to this account.' }, 403);
    }

    const amount = Number(payment.amount) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'Invalid payment amount.' }, 400);
    }

    const couponCode = notes.coupon_code?.trim().toUpperCase() || null;

    const result = await creditWalletTopUp({
      admin,
      customerId: user.id,
      amount,
      couponCode,
      razorpayPaymentId,
    });

    return json({
      success: true,
      alreadyCredited: !result.rechargeTxnId,
      ...result,
    });
  } catch (err) {
    console.error('[razorpay/verify]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Payment verification failed.' },
      400,
    );
  }
}
