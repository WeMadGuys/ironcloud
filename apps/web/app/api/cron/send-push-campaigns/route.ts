import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { processDuePushCampaigns } from '@/lib/push-campaigns';
import { ensureServerEnv, getServerSupabaseEnv } from '@/lib/server-env';

/**
 * Cron: send due scheduled push campaigns via Expo Push API.
 * Auth: Authorization: Bearer <CRON_SECRET>
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

  try {
    const result = await processDuePushCampaigns(admin);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/send-push-campaigns]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
