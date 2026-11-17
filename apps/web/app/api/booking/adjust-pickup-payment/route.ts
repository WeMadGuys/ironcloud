import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

type AdminClient = SupabaseClient<any>;

/** Collected, still before the order is delivered. */
const ADJUSTABLE_STATUSES = [
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

/**
 * Rewrite the existing pickup debit when a collected order total changes.
 * Does not insert a second wallet row.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: { orderId?: string; newAmount?: number };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    const orderId = body.orderId?.trim();
    const newAmount = money(body.newAmount);
    if (!orderId) {
      return json({ error: 'orderId is required.' }, 400);
    }
    if (newAmount <= 0) {
      return json({ error: 'newAmount must be greater than zero.' }, 400);
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

    if (
      !ADJUSTABLE_STATUSES.includes(
        order.status as (typeof ADJUSTABLE_STATUSES)[number],
      )
    ) {
      return json({ error: 'This order can no longer be changed.' }, 409);
    }

    const { data: refunds, error: refundError } = await admin
      .from('wallet_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'refund');

    if (refundError) {
      return json({ error: refundError.message }, 500);
    }
    if ((refunds ?? []).length > 0) {
      return json(
        { error: 'A refund already exists for this order.' },
        409,
      );
    }

    const { data: debits, error: debitError } = await admin
      .from('wallet_transactions')
      .select('id, amount, balance_after, created_at, wallet_id')
      .eq('order_id', orderId)
      .eq('type', 'debit');

    if (debitError) {
      return json({ error: debitError.message }, 500);
    }

    const debitRows = debits ?? [];
    if (debitRows.length === 0) {
      return json({ success: true, adjusted: false, amount: newAmount });
    }
    if (debitRows.length > 1) {
      return json(
        { error: 'More than one wallet debit exists for this order.' },
        409,
      );
    }

    const debit = debitRows[0] as {
      id: string;
      amount: number | string;
      balance_after: number | string;
      created_at: string;
      wallet_id: string;
    };
    const currentDebit = money(Math.abs(Number(debit.amount)));
    const delta = money(newAmount - currentDebit);
    if (delta === 0) {
      return json({ success: true, adjusted: false, amount: newAmount });
    }

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
    if (delta > 0 && balance < delta) {
      return json(
        {
          error: 'Insufficient wallet balance.',
          insufficient: true,
          amount: delta,
          balance,
        },
        402,
      );
    }

    const newBalance = money(balance - delta);
    const { error: updateWalletError } = await admin
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id);

    if (updateWalletError) {
      return json({ error: updateWalletError.message }, 500);
    }

    const newDebitBalanceAfter = money(Number(debit.balance_after) - delta);
    const { error: updateDebitError } = await admin
      .from('wallet_transactions')
      .update({
        amount: money(-newAmount),
        balance_after: newDebitBalanceAfter,
      })
      .eq('id', debit.id);

    if (updateDebitError) {
      await admin.from('wallets').update({ balance }).eq('id', wallet.id);
      return json({ error: updateDebitError.message }, 500);
    }

    const { data: laterRows, error: laterError } = await admin
      .from('wallet_transactions')
      .select('id, balance_after')
      .eq('wallet_id', wallet.id)
      .gt('created_at', debit.created_at);

    if (laterError) {
      return json({ error: laterError.message }, 500);
    }

    for (const row of laterRows ?? []) {
      const nextAfter = money(Number(row.balance_after) - delta);
      const { error: shiftError } = await admin
        .from('wallet_transactions')
        .update({ balance_after: nextAfter })
        .eq('id', row.id);
      if (shiftError) {
        return json({ error: shiftError.message }, 500);
      }
    }

    return json({
      success: true,
      adjusted: true,
      amount: newAmount,
      delta,
      balance: newBalance,
    });
  } catch (err) {
    console.error('[adjust-pickup-payment]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Payment adjustment failed.' },
      500,
    );
  }
}
