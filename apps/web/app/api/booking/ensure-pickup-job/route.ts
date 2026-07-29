import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { resolvePickupRiderForCommunity } from '@/lib/resolve-pickup-rider';
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

/**
 * Create (or reuse) the pickup rider_job for a customer order.
 * Clients cannot insert rider_jobs under RLS — this must use the service role.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: {
      orderId?: string;
      riderId?: string;
      scheduledStart?: string;
      scheduledEnd?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    if (!orderId) {
      return json({ error: 'orderId is required.' }, 400);
    }

    const preferredRiderId = body.riderId?.trim() || null;

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
      .select('id, customer_id, community_id, status, pickup_slot_id')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      return json({ error: orderError.message }, 500);
    }
    if (!order) {
      return json({ error: 'Order not found.' }, 404);
    }
    if (order.customer_id !== user.id) {
      return json({ error: 'You can only assign jobs for your own orders.' }, 403);
    }
    if (['cancelled', 'completed', 'rated'].includes(order.status)) {
      return json({ error: 'This order can no longer be assigned.' }, 409);
    }

    const { data: existingJob } = await admin
      .from('rider_jobs')
      .select('id, rider_id')
      .eq('order_id', orderId)
      .eq('job_type', 'pickup')
      .maybeSingle();

    if (existingJob) {
      return json({
        success: true,
        jobId: existingJob.id,
        riderId: existingJob.rider_id,
        alreadyExisted: true,
      });
    }

    const resolved = preferredRiderId
      ? await (async () => {
          const { data: link } = await admin
            .from('rider_communities')
            .select('rider_id')
            .eq('community_id', order.community_id)
            .eq('rider_id', preferredRiderId)
            .maybeSingle();

          if (!link) {
            // Stale/invalid preferred rider — fall back to full resolve.
            return resolvePickupRiderForCommunity(admin, order.community_id);
          }

          return {
            riderId: preferredRiderId,
            riderName: 'Pickup Partner',
            riderPhone: null as string | null,
          };
        })()
      : await resolvePickupRiderForCommunity(admin, order.community_id);

    if ('error' in resolved) {
      return json({ error: resolved.error }, resolved.status);
    }

    let scheduledStart = body.scheduledStart ?? null;
    let scheduledEnd = body.scheduledEnd ?? null;

    if ((!scheduledStart || !scheduledEnd) && order.pickup_slot_id) {
      const { data: slot } = await admin
        .from('service_slots')
        .select('window_start, window_end')
        .eq('id', order.pickup_slot_id)
        .maybeSingle();
      scheduledStart = scheduledStart ?? slot?.window_start ?? null;
      scheduledEnd = scheduledEnd ?? slot?.window_end ?? null;
    }

    const { data: job, error: jobError } = await admin
      .from('rider_jobs')
      .insert({
        order_id: orderId,
        rider_id: resolved.riderId,
        job_type: 'pickup',
        status: 'assigned',
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      return json(
        { error: jobError?.message || 'Failed to create pickup job.' },
        500,
      );
    }

    return json({
      success: true,
      jobId: job.id,
      riderId: resolved.riderId,
      riderName: resolved.riderName,
      riderPhone: resolved.riderPhone,
      alreadyExisted: false,
    });
  } catch (err) {
    console.error('[ensure-pickup-job]', err);
    return json(
      {
        error: err instanceof Error ? err.message : 'Failed to create pickup job.',
      },
      500,
    );
  }
}
