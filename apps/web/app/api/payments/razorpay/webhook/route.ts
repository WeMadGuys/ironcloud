import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import { mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { getRazorpayEnv, verifyWebhookSignature } from '@/lib/razorpay';
import { creditWalletTopUp } from '@/lib/wallet-topup';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

export async function POST(req: Request) {
  ensureServerEnv();

  const { webhookSecret } = getRazorpayEnv();
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          status?: string;
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (payload.event !== 'payment.captured') {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const payment = payload.payload?.payment?.entity;
  const razorpayPaymentId = payment?.id;
  const razorpayOrderId = payment?.order_id;

  if (!razorpayPaymentId || !razorpayOrderId || payment?.status !== 'captured') {
    return NextResponse.json({ error: 'Incomplete payment payload.' }, { status: 400 });
  }

  const { url, serviceRoleKey, missing } = getServerSupabaseEnv();
  if (missing.length) {
    return NextResponse.json({ error: `Missing env: ${missing.join(', ')}` }, { status: 500 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const Razorpay = (await import('razorpay')).default;
    const { keyId, keySecret } = getRazorpayEnv();
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.fetch(razorpayOrderId);

    const notes = (order.notes ?? {}) as Record<string, string>;
    if (notes.purpose !== 'wallet_topup') {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const customerId = notes.customer_id;
    if (!customerId) {
      return NextResponse.json({ error: 'Missing customer on order.' }, { status: 400 });
    }

    const amount = Number(order.amount) / 100;
    const couponCode = notes.coupon_code?.trim().toUpperCase() || null;

    await creditWalletTopUp({
      admin,
      customerId,
      amount,
      couponCode,
      razorpayPaymentId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[razorpay/webhook]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook processing failed.' },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}
