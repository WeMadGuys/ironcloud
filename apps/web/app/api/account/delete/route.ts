import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { persistBenefitClaimsForUser } from '@ironcloud/api/benefit-identity';
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

const CANCELLABLE_ORDER_STATUSES = [
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
] as const;

/**
 * Self-serve account deletion (Play Store / App Store requirement).
 * Anonymizes PII in place (keeps order FKs), strips login, bans auth user.
 * Does not hard-delete auth.users — profiles cascade would break order history.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: { confirm?: boolean } = {};
    try {
      body = (await req.json()) as { confirm?: boolean };
    } catch {
      // empty body is fine if confirm is sent as query later — require confirm below
    }

    if (body.confirm !== true) {
      return json(
        { error: 'Pass { "confirm": true } to permanently delete your account.' },
        400,
      );
    }

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

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, avatar_url, phone')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      return json({ error: profileError.message }, 500);
    }
    if (!profile) {
      return json({ error: 'Profile not found.' }, 404);
    }

    const role = profile.role as string;

    if (role === 'customer') {
      const { data: wallet, error: walletError } = await admin
        .from('wallets')
        .select('balance')
        .eq('customer_id', user.id)
        .maybeSingle();

      if (walletError) {
        return json({ error: walletError.message }, 500);
      }

      const balance = Number((wallet as { balance?: number } | null)?.balance ?? 0);
      if (Number.isFinite(balance) && balance > 0) {
        return json(
          {
            error:
              'Account deletion is blocked while wallet balance remains. Please contact support.',
          },
          400,
        );
      }

      await deleteCustomerAccount(admin, user.id);
    } else if (role === 'rider') {
      await deleteRiderAccount(admin, user.id);
    } else {
      return json(
        { error: 'Only customer and rider accounts can be deleted from the app.' },
        403,
      );
    }

    await persistBenefitClaimsForUser(admin, user.id, profile.phone);
    await anonymizeProfile(admin, user.id, profile.avatar_url);
    await stripAuthLogin(admin, user.id);

    return json({ success: true });
  } catch (err) {
    console.error('[account/delete]', err);
    return json(
      {
        error: err instanceof Error ? err.message : 'Failed to delete account.',
      },
      500,
    );
  }
}

async function deleteCustomerAccount(admin: AdminClient, userId: string) {
  // Cancel open pre-pickup bookings and close their rider jobs.
  const { data: openOrders } = await admin
    .from('orders')
    .select('id')
    .eq('customer_id', userId)
    .in('status', [...CANCELLABLE_ORDER_STATUSES]);

  const orderIds = (openOrders ?? []).map((o) => o.id as string);
  if (orderIds.length > 0) {
    await admin
      .from('orders')
      .update({ status: 'cancelled' })
      .in('id', orderIds);

    await admin.from('order_events').insert(
      orderIds.map((orderId) => ({
        order_id: orderId,
        status: 'cancelled',
        actor_id: userId,
        note: 'Cancelled — customer deleted account',
        metadata: { source: 'account_delete' },
      })),
    );

    await admin
      .from('rider_jobs')
      .update({
        status: 'failed',
        failure_reason: 'Customer deleted account',
        completed_at: new Date().toISOString(),
      })
      .in('order_id', orderIds)
      .in('status', ['assigned', 'in_progress']);
  }

  // Scrub address PII (rows kept if referenced by orders).
  await admin
    .from('addresses')
    .update({
      flat_number: '—',
      tower: null,
    })
    .eq('customer_id', userId);
}

async function deleteRiderAccount(admin: AdminClient, userId: string) {
  await admin
    .from('rider_jobs')
    .update({
      status: 'failed',
      failure_reason: 'Rider deleted account',
      completed_at: new Date().toISOString(),
    })
    .eq('rider_id', userId)
    .in('status', ['assigned', 'in_progress']);

  await admin.from('rider_communities').delete().eq('rider_id', userId);

  await admin
    .from('riders')
    .update({
      is_active: false,
      vehicle_number: null,
      current_lat: null,
      current_lng: null,
    })
    .eq('id', userId);
}

async function anonymizeProfile(
  admin: AdminClient,
  userId: string,
  avatarUrl: string | null,
) {
  if (avatarUrl) {
    try {
      const marker = '/avatars/';
      const idx = avatarUrl.indexOf(marker);
      if (idx >= 0) {
        const path = avatarUrl.slice(idx + marker.length).split('?')[0];
        if (path) {
          await admin.storage.from('avatars').remove([path]);
        }
      }
      // Also try folder listing for this user.
      const { data: files } = await admin.storage.from('avatars').list(userId);
      if (files && files.length > 0) {
        await admin.storage
          .from('avatars')
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
    } catch (err) {
      console.warn('[account/delete] avatar cleanup', err);
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({
      full_name: 'Deleted User',
      phone: null,
      email: null,
      avatar_url: null,
      referral_code: null,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function stripAuthLogin(admin: AdminClient, userId: string) {
  const deletedEmail = `deleted.${userId.replace(/-/g, '')}@deleted.ironcloud.invalid`;
  // Unique placeholder phone so the real number can re-register.
  const stubDigits = userId.replace(/\D/g, '').slice(0, 10).padEnd(10, '0');
  const stubPhone = `+1999${stubDigits}`;

  const { error } = await admin.auth.admin.updateUserById(userId, {
    email: deletedEmail,
    email_confirm: true,
    phone: stubPhone,
    phone_confirm: true,
    ban_duration: '876000h',
    user_metadata: {
      deleted: true,
      deleted_at: new Date().toISOString(),
      phone: null,
      role: null,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}
