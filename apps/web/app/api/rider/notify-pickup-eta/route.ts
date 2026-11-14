import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { notifyCustomerPickupEta } from '@/lib/notify-customer-pickup-eta';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

type AdminClient = SupabaseClient<any>;

const OPEN_PICKUP_STATUSES = new Set([
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
]);

const COOLDOWN_MS = 10 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: corsHeaders });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const bearerToken = (req: Request): string | null => {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
};

/**
 * Rider tells the customer they are on the way for pickup.
 * Message text is fixed on the server. Only the assigned rider can send it,
 * and only while the pickup is still open.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

    let body: { orderId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    if (!orderId) return json({ error: 'orderId is required.' }, 400);

    const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length) {
      return json({ error: `Missing env: ${missing.join(', ')}` }, 500);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) return json({ error: 'Invalid session.' }, 401);

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as AdminClient;

    const { data: riderJob } = await admin
      .from('rider_jobs')
      .select('id, status')
      .eq('order_id', orderId)
      .eq('rider_id', user.id)
      .eq('job_type', 'pickup')
      .maybeSingle();

    if (!riderJob || riderJob.status === 'completed') {
      return json({ error: 'This pickup is no longer open.' }, 403);
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) return json({ error: 'Order not found.' }, 404);

    if (!OPEN_PICKUP_STATUSES.has(order.status)) {
      return json({ error: 'Clothes are already collected for this order.' }, 409);
    }

    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { data: recent } = await admin
      .from('order_events')
      .select('id')
      .eq('order_id', orderId)
      .gte('created_at', since)
      .contains('metadata', { kind: 'pickup_eta' })
      .limit(1);

    if (recent && recent.length > 0) {
      return json(
        { error: 'Already sent. You can notify this customer again in a few minutes.' },
        429,
      );
    }

    const result = await notifyCustomerPickupEta(admin, {
      customerId: order.customer_id,
      orderId,
    });

    if (!result.sent) {
      return json(
        { error: 'This customer has no notification device yet. Ask them to open the app on their phone.' },
        404,
      );
    }

    await admin.from('order_events').insert({
      order_id: orderId,
      status: order.status,
      note: 'Customer notified: rider is on the way',
      actor_id: user.id,
      metadata: { kind: 'pickup_eta' },
    });

    return json({ ok: true });
  } catch (err) {
    console.error('[notify-pickup-eta]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Could not send the notification.' },
      500,
    );
  }
}
