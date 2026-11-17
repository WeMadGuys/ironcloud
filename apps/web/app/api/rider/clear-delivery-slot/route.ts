import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

type AdminClient = SupabaseClient<any>;

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

/** Drop the booked delivery slot after a rider confirms pickup without a delivery date. */
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
    if (missing.length) return json({ error: `Missing env: ${missing.join(', ')}` }, 500);

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

    const { data: riderJobs } = await admin
      .from('rider_jobs')
      .select('id')
      .eq('order_id', orderId)
      .eq('rider_id', user.id)
      .eq('job_type', 'pickup')
      .limit(1);

    if (!riderJobs?.length) return json({ error: 'Not authorized for this pickup order.' }, 403);

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('delivery_slot_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError || !order) return json({ error: 'Order not found.' }, 404);

    const slotId = order.delivery_slot_id as string | null;
    const { error: clearError } = await admin
      .from('orders')
      .update({ delivery_slot_id: null })
      .eq('id', orderId);

    if (clearError) return json({ error: clearError.message }, 500);

    if (slotId) {
      const { error: releaseError } = await admin.rpc('release_service_slot_seat', {
        p_slot_id: slotId,
      });
      if (releaseError) {
        console.error('[clear-delivery-slot] seat release', releaseError);
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error('[clear-delivery-slot]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Could not clear the delivery date.' },
      500,
    );
  }
}
