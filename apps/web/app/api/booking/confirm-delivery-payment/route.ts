import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { legacyDeliveryDebitGuard, money } from '@/lib/delivery-collection';
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
 * Debit the customer wallet when the rider completes delivery.
 * Does not mark the order delivered — the rider app does that after this succeeds.
 * Orders already paid at pickup are left unchanged.
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
      .eq('job_type', 'delivery')
      .maybeSingle();

    if (!riderJob) {
      return json({ error: 'Not authorized for this delivery.' }, 403);
    }

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, customer_id, total_amount, payment_status, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return json({ error: 'Order not found.' }, 404);
    }

    if (order.status === 'cancelled') {
      return json({ error: 'This order is cancelled.' }, 409);
    }

    if (order.payment_status === 'paid') {
      return json({ success: true, paymentStatus: 'paid', alreadyPaid: true });
    }

    const amount = money(order.total_amount || 0);
    if (amount <= 0) {
      await admin.from('orders').update({ payment_status: 'paid' }).eq('id', orderId);
      return json({ success: true, paymentStatus: 'paid', amount: 0 });
    }

    const guard = await legacyDeliveryDebitGuard(admin, orderId, amount);
    if (guard.action === 'already_paid') {
      await admin.from('orders').update({ payment_status: 'paid' }).eq('id', orderId);
      return json({ success: true, paymentStatus: 'paid', alreadyPaid: true });
    }
    if (guard.action === 'blocked') {
      return json({ error: guard.error }, 409);
    }

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('id, balance')
      .eq('customer_id', order.customer_id)
      .maybeSingle();

    if (walletError) {
      return json({ error: walletError.message }, 500);
    }

    const balance = Number(wallet?.balance || 0);
    if (!wallet || balance < amount) {
      await admin
        .from('orders')
        .update({ payment_status: 'insufficient_funds' })
        .eq('id', orderId);
      return json(
        {
          success: false,
          insufficient: true,
          paymentStatus: 'insufficient_funds',
          amount,
          balance,
          error: 'Customer wallet does not cover this delivery.',
        },
        402,
      );
    }

    const newBalance = Math.round((balance - amount) * 100) / 100;

    const { error: updateWalletError } = await admin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id);

    if (updateWalletError) {
      return json({ error: updateWalletError.message }, 500);
    }

    const { error: insertError } = await admin.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      type: 'debit',
      amount: -amount,
      balance_after: newBalance,
      order_id: orderId,
      description: 'Order payment for delivery',
    });

    if (insertError) {
      await admin.from('wallets').update({ balance }).eq('id', wallet.id);
      return json({ error: insertError.message }, 500);
    }

    await admin.from('orders').update({ payment_status: 'paid' }).eq('id', orderId);

    return json({
      success: true,
      paymentStatus: 'paid',
      amount,
      balance: newBalance,
    });
  } catch (err) {
    console.error('[confirm-delivery-payment]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Payment failed.' },
      500,
    );
  }
}
