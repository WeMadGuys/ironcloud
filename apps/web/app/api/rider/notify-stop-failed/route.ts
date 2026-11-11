import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { notifyCustomerStopFailed } from '@/lib/notify-customer-stop-failed';
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

/** Assigned rider tells the customer a pickup or delivery attempt failed. */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

    let body: { orderId?: string; jobType?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    const jobType = body.jobType === 'delivery' ? 'delivery' : body.jobType === 'pickup' ? 'pickup' : null;
    if (!orderId || !jobType) return json({ error: 'orderId and jobType are required.' }, 400);

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

    const { data: riderJob } = await admin
      .from('rider_jobs')
      .select('id')
      .eq('order_id', orderId)
      .eq('rider_id', user.id)
      .eq('job_type', jobType)
      .maybeSingle();

    if (!riderJob) return json({ error: 'Not authorized for this stop.' }, 403);

    const { data: order } = await admin
      .from('orders')
      .select('customer_id')
      .eq('id', orderId)
      .maybeSingle();

    if (!order?.customer_id) return json({ error: 'Order not found.' }, 404);

    await notifyCustomerStopFailed(admin, {
      customerId: order.customer_id,
      orderId,
      jobType,
    });

    return json({ ok: true });
  } catch (err) {
    console.error('[notify-stop-failed]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Could not notify the customer.' },
      500,
    );
  }
}
