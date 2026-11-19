import { NextResponse } from 'next/server';

import { authenticateMobileRequest, mobileApiCorsHeaders } from '@/lib/api-mobile-auth';
import { DeliveryPaymentError, quoteDeliveryPayment } from '@/lib/delivery-collection';

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: mobileApiCorsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: mobileApiCorsHeaders });
}

export async function POST(req: Request) {
  const auth = await authenticateMobileRequest(req);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  let body: { orderId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const orderId = body.orderId?.trim();
  if (!orderId) return json({ error: 'orderId is required.' }, 400);

  try {
    const result = await quoteDeliveryPayment(auth.ctx.admin, auth.ctx.user.id, orderId);
    return json(result);
  } catch (err) {
    if (err instanceof DeliveryPaymentError) {
      return json({ error: err.message, ...err.details }, err.status);
    }
    console.error('[delivery-payment/quote]', err);
    return json({ error: err instanceof Error ? err.message : 'Quote failed.' }, 500);
  }
}
