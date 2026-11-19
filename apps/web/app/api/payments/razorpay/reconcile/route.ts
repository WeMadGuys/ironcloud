import { NextResponse } from 'next/server';

import { authenticateMobileRequest, mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { getRazorpayClient } from '@/lib/razorpay';
import { creditWalletTopUp } from '@/lib/wallet-topup';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: mobileApiCorsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}

type RazorpayPaymentItem = {
  id?: string;
  status?: string;
  amount?: number;
  order_id?: string;
};

/**
 * After Razorpay checkout is dismissed (X / back), the SDK often reports
 * "cancelled" even when UPI already captured the payment. This endpoint
 * looks up the order and credits the wallet if a captured payment exists.
 */
export async function POST(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const { user, admin } = auth.ctx;

  let body: { razorpayOrderId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const razorpayOrderId = body.razorpayOrderId?.trim();
  if (!razorpayOrderId) {
    return json({ error: 'Missing Razorpay order id.' }, 400);
  }

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.fetch(razorpayOrderId);
    const notes = (order.notes ?? {}) as Record<string, string>;

    if (notes.purpose !== 'wallet_topup') {
      return json({ error: 'Invalid payment purpose.' }, 400);
    }
    if (notes.customer_id !== user.id) {
      return json({ error: 'Payment does not belong to this account.' }, 403);
    }

    const payments = (await razorpay.orders.fetchPayments(razorpayOrderId)) as {
      items?: RazorpayPaymentItem[];
    };
    const captured = (payments.items ?? []).find((item) => item.status === 'captured' && item.id);

    if (!captured?.id) {
      const orderStatus = typeof order.status === 'string' ? order.status : 'created';
      return json({
        status: 'pending',
        orderStatus,
      });
    }

    const amount = Number(captured.amount) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'Invalid payment amount.' }, 400);
    }

    const couponCode = notes.coupon_code?.trim().toUpperCase() || null;

    const result = await creditWalletTopUp({
      admin,
      customerId: user.id,
      amount,
      couponCode,
      razorpayPaymentId: captured.id,
    });

    return json({
      status: 'credited',
      alreadyCredited: !result.rechargeTxnId,
      ...result,
    });
  } catch (err) {
    console.error('[razorpay/reconcile]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Could not confirm payment.' },
      400,
    );
  }
}
