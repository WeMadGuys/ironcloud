import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { createCustomerBooking } from '@/lib/create-customer-booking';
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

type CreateBody = {
  dayOffset?: number;
  pickupStartHour?: number;
  pickupWindowStart?: string;
  pickupWindowEnd?: string;
  timeZone?: string;
  specialInstructions?: string;
  estimatedGarments?: {
    serviceId?: string;
    name?: string;
    quantity?: number;
    unitPrice?: number;
  }[];
  estimatedAmount?: number;
};

/**
 * Create a customer booking in one request (slots + order + events + pickup job).
 * Service role required for rider_jobs / rider_communities under RLS.
 */
export async function POST(req: Request) {
  ensureServerEnv();

  try {
    const token = bearerToken(req);
    if (!token) {
      return json({ error: 'Missing Authorization bearer token.' }, 401);
    }

    let body: CreateBody;
    try {
      body = (await req.json()) as CreateBody;
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400);
    }

    if (
      typeof body.dayOffset !== 'number' ||
      typeof body.pickupStartHour !== 'number' ||
      !body.pickupWindowStart?.trim() ||
      !body.pickupWindowEnd?.trim()
    ) {
      return json(
        {
          error:
            'dayOffset, pickupStartHour, pickupWindowStart, and pickupWindowEnd are required.',
        },
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

    const estimatedGarments = (body.estimatedGarments || [])
      .filter(
        (line) =>
          typeof line.serviceId === 'string' &&
          typeof line.name === 'string' &&
          typeof line.quantity === 'number' &&
          line.quantity > 0 &&
          typeof line.unitPrice === 'number',
      )
      .map((line) => ({
        serviceId: line.serviceId as string,
        name: line.name as string,
        quantity: line.quantity as number,
        unitPrice: line.unitPrice as number,
      }));

    const result = await createCustomerBooking(admin, {
      customerId: user.id,
      dayOffset: body.dayOffset,
      pickupStartHour: body.pickupStartHour,
      pickupWindowStart: body.pickupWindowStart.trim(),
      pickupWindowEnd: body.pickupWindowEnd.trim(),
      timeZone: body.timeZone?.trim() || null,
      specialInstructions: body.specialInstructions ?? null,
      estimatedGarments,
      estimatedAmount:
        typeof body.estimatedAmount === 'number' ? body.estimatedAmount : null,
    });

    if (!result.success) {
      return json({ error: result.error }, result.status);
    }

    return json({
      success: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      alreadyExisted: result.alreadyExisted ?? false,
    });
  } catch (err) {
    console.error('[create-booking]', err);
    return json(
      {
        error: err instanceof Error ? err.message : 'Failed to create booking.',
      },
      500,
    );
  }
}
