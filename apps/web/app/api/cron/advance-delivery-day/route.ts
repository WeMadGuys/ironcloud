import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

/**
 * Cron: promote orders whose delivery day has arrived to out_for_delivery.
 * Auth: Authorization: Bearer <CRON_SECRET> (or Vercel Cron sends this automatically
 * when CRON_SECRET is set in the project env).
 */
export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}

async function run(req: Request) {
  ensureServerEnv();

  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url, serviceRoleKey, missing } = getServerSupabaseEnv();
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
      { status: 500 },
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc('advance_orders_for_delivery_day');

  if (error) {
    console.error('[cron/advance-delivery-day]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    advanced: typeof data === 'number' ? data : Number(data ?? 0),
  });
}
