import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

type AdminClient = SupabaseClient<any>;

/** Customer may cancel only before pickup is completed. */
const CANCELLABLE_STATUSES = [
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
] as const;

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
 * Cancel a customer's own booking (pre-pickup only).
 * Service role required — customers have no UPDATE policy on orders.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: { orderId?: string; reason?: string };
    try {
      body = (await req.json()) as { orderId?: string; reason?: string };
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    if (!orderId) {
      return json({ error: 'orderId is required.' }, 400);
    }

    const { url, anonKey, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length > 0) {
      return json(
        { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
        500,
      );
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }

    const admin: AdminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      return json({ error: orderError.message }, 500);
    }
    if (!order) {
      return json({ error: 'Order not found.' }, 404);
    }
    if (order.customer_id !== user.id) {
      return json({ error: 'You can only cancel your own bookings.' }, 403);
    }
    if (
      !CANCELLABLE_STATUSES.includes(
        order.status as (typeof CANCELLABLE_STATUSES)[number],
      )
    ) {
      return json(
        {
          error:
            'This booking can no longer be cancelled. Pickup may already be underway or complete.',
        },
        409,
      );
    }

    const { error: updateError } = await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    await admin.from('order_events').insert({
      order_id: orderId,
      status: 'cancelled',
      actor_id: user.id,
      note: body.reason?.trim() || 'Cancelled by customer',
      metadata: {},
    });

    // Close open pickup/delivery jobs so they leave the rider queue
    await admin
      .from('rider_jobs')
      .update({
        status: 'failed',
        failure_reason: 'Customer cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)
      .in('status', ['assigned', 'in_progress']);

    return json({ success: true });
  } catch (err) {
    console.error('[cancel-booking]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Failed to cancel booking.' },
      500,
    );
  }
}
