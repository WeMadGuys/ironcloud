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

/**
 * Debit customer wallet after pickup confirmation.
 * Pickup itself must already have set orders.total_amount / status=picked_up.
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
      .select('id, customer_id, total_amount, payment_status, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return json({ error: 'Order not found.' }, 404);
    }

    if (order.payment_status === 'paid') {
      return json({ success: true, paymentStatus: 'paid', alreadyPaid: true });
    }

    const amount = Number(order.total_amount || 0);
    if (amount <= 0) {
      await admin
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);
      return json({ success: true, paymentStatus: 'paid', amount: 0 });
    }

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('id, balance')
      .eq('customer_id', order.customer_id)
      .maybeSingle();

    if (walletError) {
      return json({ error: walletError.message }, 500);
    }

    if (!wallet) {
      await admin
        .from('orders')
        .update({ payment_status: 'insufficient_funds' })
        .eq('id', orderId);
      return json({
        success: true,
        paymentStatus: 'insufficient_funds',
        amount,
      });
    }

    const balance = Number(wallet.balance || 0);
    if (balance < amount) {
      await admin
        .from('orders')
        .update({ payment_status: 'insufficient_funds' })
        .eq('id', orderId);
      return json({
        success: true,
        paymentStatus: 'insufficient_funds',
        amount,
        balance,
      });
    }

    const newBalance = balance - amount;

    const { error: updateWalletError } = await admin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id);

    if (updateWalletError) {
      return json({ error: updateWalletError.message }, 500);
    }

    await admin.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      type: 'debit',
      amount: -amount,
      balance_after: newBalance,
      order_id: orderId,
      description: `Order payment for pickup ${orderId}`,
    });

    await admin
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', orderId);

    return json({
      success: true,
      paymentStatus: 'paid',
      amount,
      balance: newBalance,
    });
  } catch (err) {
    console.error('[confirm-pickup-payment]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Payment failed.' },
      500,
    );
  }
}
