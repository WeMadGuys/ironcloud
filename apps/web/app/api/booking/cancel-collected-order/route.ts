import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

type AdminClient = SupabaseClient<any>;

/** Collected, still before the order is delivered. */
const CANCELLABLE_STATUSES = [
  'picked_up',
  'picked_up_no_delivery',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
  'delivery_assigned',
  'out_for_delivery',
] as const;

const CANCEL_NOTE = 'Order cancelled';

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

function money(value: unknown): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

async function failOpenDeliveryJobs(admin: AdminClient, orderId: string): Promise<void> {
  await admin
    .from('rider_jobs')
    .update({
      status: 'failed',
      failure_reason: CANCEL_NOTE,
      completed_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('job_type', 'delivery')
    .in('status', ['assigned', 'in_progress']);
}

async function ensureCancelEvent(
  admin: AdminClient,
  orderId: string,
  actorId: string,
): Promise<string | null> {
  const { data: existingEvent, error: lookupError } = await admin
    .from('order_events')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'cancelled')
    .eq('note', CANCEL_NOTE)
    .maybeSingle();

  if (lookupError) return lookupError.message;
  if (existingEvent) return null;

  const { error: eventError } = await admin.from('order_events').insert({
    order_id: orderId,
    status: 'cancelled',
    actor_id: actorId,
    note: CANCEL_NOTE,
    metadata: { source: 'rider_cancel_collected_order' },
  });
  return eventError?.message ?? null;
}

/**
 * Cancel a collected order and credit the existing pickup debit back.
 * The original debit stays. One refund row is added: "Order cancelled".
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: { orderId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    if (!orderId) {
      return json({ error: 'orderId is required.' }, 400);
    }

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

    if (userError || !user) {
      return json({ error: 'Invalid session.' }, 401);
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as AdminClient;

    const { data: riderJob } = await admin
      .from('rider_jobs')
      .select('id')
      .eq('order_id', orderId)
      .eq('rider_id', user.id)
      .eq('job_type', 'pickup')
      .maybeSingle();

    if (!riderJob) {
      return json({ error: 'Not authorized for this pickup order.' }, 403);
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return json({ error: 'Order not found.' }, 404);
    }

    if (order.status === 'cancelled') {
      const eventError = await ensureCancelEvent(admin, orderId, user.id);
      if (eventError) return json({ error: eventError }, 500);
      await failOpenDeliveryJobs(admin, orderId);
      return json({ success: true, alreadyCancelled: true });
    }

    if (
      !CANCELLABLE_STATUSES.includes(
        order.status as (typeof CANCELLABLE_STATUSES)[number],
      )
    ) {
      return json({ error: 'This order can no longer be cancelled.' }, 409);
    }

    const { data: refunds, error: refundError } = await admin
      .from('wallet_transactions')
      .select('id, description')
      .eq('order_id', orderId)
      .eq('type', 'refund');

    if (refundError) {
      return json({ error: refundError.message }, 500);
    }

    const refundRows = (refunds ?? []) as Array<{ id: string; description: string | null }>;
    const cancelRefund = refundRows.find((row) => row.description === CANCEL_NOTE);
    const otherRefund = refundRows.some((row) => row.description !== CANCEL_NOTE);
    if (otherRefund) {
      return json(
        { error: 'A refund already exists for this order.' },
        409,
      );
    }

    const { data: debits, error: debitError } = await admin
      .from('wallet_transactions')
      .select('id, amount, wallet_id')
      .eq('order_id', orderId)
      .eq('type', 'debit');

    if (debitError) {
      return json({ error: debitError.message }, 500);
    }

    const debitRows = debits ?? [];
    if (debitRows.length > 1) {
      return json(
        { error: 'More than one wallet debit exists for this order.' },
        409,
      );
    }

    let credited = 0;
    if (!cancelRefund && debitRows.length === 1) {
      const debit = debitRows[0] as {
        amount: number | string;
        wallet_id: string;
      };
      credited = money(Math.abs(Number(debit.amount)));
      if (credited > 0) {
        const { data: wallet, error: walletError } = await admin
          .from('wallets')
          .select('id, balance')
          .eq('id', debit.wallet_id)
          .maybeSingle();

        if (walletError) {
          return json({ error: walletError.message }, 500);
        }
        if (!wallet) {
          return json({ error: 'Wallet not found.' }, 404);
        }

        const balance = money(wallet.balance);
        const newBalance = money(balance + credited);
        const { error: updateWalletError } = await admin
          .from('wallets')
          .update({ balance: newBalance })
          .eq('id', wallet.id);

        if (updateWalletError) {
          return json({ error: updateWalletError.message }, 500);
        }

        const { error: insertError } = await admin.from('wallet_transactions').insert({
          wallet_id: wallet.id,
          type: 'refund',
          amount: credited,
          balance_after: newBalance,
          order_id: orderId,
          description: CANCEL_NOTE,
        });

        if (insertError) {
          await admin.from('wallets').update({ balance }).eq('id', wallet.id);
          return json({ error: insertError.message }, 500);
        }
      }
    }

    const { error: updateOrderError } = await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId);

    if (updateOrderError) {
      return json({ error: updateOrderError.message }, 500);
    }

    const eventError = await ensureCancelEvent(admin, orderId, user.id);
    if (eventError) return json({ error: eventError }, 500);

    await failOpenDeliveryJobs(admin, orderId);

    return json({ success: true, credited });
  } catch (err) {
    console.error('[cancel-collected-order]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Cancel failed.' },
      500,
    );
  }
}
