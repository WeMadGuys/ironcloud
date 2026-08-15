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
 * Pre-check: can the customer's wallet cover the pickup total?
 * Does not mutate wallet or order — used before confirming pickup.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: { orderId?: string; amount?: number };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    const amount = Number(body.amount);
    if (!orderId) {
      return json({ error: 'orderId is required.' }, 400);
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return json({ error: 'amount must be a non-negative number.' }, 400);
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
      .select('id, customer_id, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return json({ error: 'Order not found.' }, 404);
    }

    if (order.payment_status === 'paid') {
      return json({
        ok: true,
        sufficient: true,
        alreadyPaid: true,
        amount,
      });
    }

    if (amount <= 0) {
      return json({ ok: true, sufficient: true, amount: 0, balance: 0 });
    }

    const { data: wallet, error: walletError } = await admin
      .from('wallets')
      .select('id, balance')
      .eq('customer_id', order.customer_id)
      .maybeSingle();

    if (walletError) {
      return json({ error: walletError.message }, 500);
    }

    const balance = Number(wallet?.balance ?? 0);
    const sufficient = balance >= amount;

    return json({
      ok: true,
      sufficient,
      amount,
      balance,
    });
  } catch (err) {
    console.error('[check-pickup-wallet]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Wallet check failed.' },
      500,
    );
  }
}
