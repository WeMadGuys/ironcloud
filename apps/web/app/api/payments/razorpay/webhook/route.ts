import { NextResponse } from 'next/server';

import { createClient } from '@supabase/supabase-js';

import { mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { settleDeliveryQrPayment } from '@/lib/delivery-collection';
import { getRazorpayEnv, verifyWebhookSignature } from '@/lib/razorpay';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';
import { creditWalletTopUp } from '@/lib/wallet-topup';

type PaymentEntity = {
  id?: string;
  order_id?: string | null;
  status?: string;
  amount?: number;
  qr_code_id?: string;
  notes?: Record<string, string>;
};

type QrEntity = {
  id?: string;
  notes?: Record<string, string>;
  payment_amount?: number;
};

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: PaymentEntity };
    qr_code?: { entity?: QrEntity };
  };
};

function notesOf(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const notes: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string') notes[key] = entry;
  }
  return notes;
}

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

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { url, serviceRoleKey, missing } = getServerSupabaseEnv();
  if (missing.length) {
    return NextResponse.json({ error: `Missing env: ${missing.join(', ')}` }, { status: 500 });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (payload.event === 'qr_code.credited') {
      const qr = payload.payload?.qr_code?.entity;
      const payment = payload.payload?.payment?.entity;
      const qrId = qr?.id;
      const paymentId = payment?.id;
      const notes = notesOf(qr?.notes);
      if (!qrId || !paymentId || payment?.status !== 'captured') {
        return NextResponse.json({ error: 'Incomplete QR payload.' }, { status: 400 });
      }
      if (notes.purpose && notes.purpose !== 'delivery_collection') {
        return NextResponse.json({ ok: true, ignored: true });
      }
      const result = await settleDeliveryQrPayment(admin, {
        qrId,
        paymentId,
        amountPaise: Number(payment.amount ?? 0),
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (payload.event !== 'payment.captured') {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const payment = payload.payload?.payment?.entity;
    const razorpayPaymentId = payment?.id;
    const razorpayOrderId = payment?.order_id?.trim() || '';
    if (!razorpayPaymentId || payment?.status !== 'captured') {
      return NextResponse.json({ error: 'Incomplete payment payload.' }, { status: 400 });
    }

    // UPI QR payments have no Razorpay order. Never credit them into the wallet.
    if (!razorpayOrderId) {
      const notes = notesOf(payment.notes);
      const qrId = payment.qr_code_id;
      if (notes.purpose === 'delivery_collection' && qrId) {
        const result = await settleDeliveryQrPayment(admin, {
          qrId,
          paymentId: razorpayPaymentId,
          amountPaise: Number(payment.amount ?? 0),
        });
        return NextResponse.json({ ok: true, ...result });
      }
      return NextResponse.json({ ok: true, ignored: true });
    }

    const Razorpay = (await import('razorpay')).default;
    const { keyId, keySecret } = getRazorpayEnv();
    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.fetch(razorpayOrderId);

    const notes = notesOf(order.notes);
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
