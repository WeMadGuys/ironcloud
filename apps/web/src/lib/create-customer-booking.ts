import type { SupabaseClient } from '@supabase/supabase-js';

import { resolvePickupRiderForCommunity } from '@/lib/resolve-pickup-rider';

type AdminClient = SupabaseClient<any>;

const AWAITING_STATUSES = ['booked', 'pickup_assigned', 'pickup_in_progress'] as const;

const ACTIVE_HOME_STATUSES = [
  ...AWAITING_STATUSES,
  'picked_up',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
  'delivery_assigned',
  'out_for_delivery',
  'delivered',
] as const;

export type CreateCustomerBookingInput = {
  customerId: string;
  dayOffset: number;
  pickupStartHour: number;
  /** ISO pickup window from the customer's device (preserves local slot times). */
  pickupWindowStart: string;
  pickupWindowEnd: string;
  /** IANA timezone from the device; used for same-day conflict checks. */
  timeZone?: string | null;
  specialInstructions?: string | null;
  estimatedGarments?: {
    serviceId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
  estimatedAmount?: number | null;
};

export type CreateCustomerBookingResult =
  | {
      success: true;
      orderId: string;
      orderNumber: string;
      alreadyExisted?: boolean;
    }
  | { success: false; error: string; status: number };

function getHomeOrderPhase(status: string): 'awaiting_pickup' | 'picked_up' | 'delivered' {
  if (AWAITING_STATUSES.includes(status as (typeof AWAITING_STATUSES)[number])) {
    return 'awaiting_pickup';
  }
  if (status === 'delivered') return 'delivered';
  return 'picked_up';
}

/** Calendar day key in a timezone (YYYY-MM-DD). */
function zonedDayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isSameZonedDay(
  pickupStart: Date | null,
  anchor: Date,
  timeZone: string,
): boolean {
  if (!pickupStart) return false;
  return zonedDayKey(pickupStart, timeZone) === zonedDayKey(anchor, timeZone);
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `IC${y}${m}${d}${rand}`.slice(0, 12);
}

function getDeliveryWindowFromPickup(pickupStart: Date, pickupEnd: Date) {
  const start = new Date(pickupStart);
  start.setTime(start.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(pickupEnd);
  end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function ensureServiceSlot(
  admin: AdminClient,
  params: {
    communityId: string;
    slotType: 'pickup' | 'delivery';
    windowStart: Date;
    windowEnd: Date;
  },
): Promise<string> {
  const windowStartIso = params.windowStart.toISOString();
  const windowEndIso = params.windowEnd.toISOString();

  const findExisting = async () => {
    const { data, error } = await admin
      .from('service_slots')
      .select('id, booked_count')
      .eq('community_id', params.communityId)
      .eq('slot_type', params.slotType)
      .eq('window_start', windowStartIso)
      .maybeSingle();

    if (error) {
      console.warn('[create-booking] service_slots lookup failed:', error.message);
      return null;
    }
    return data as { id: string; booked_count: number | null } | null;
  };

  const existing = await findExisting();
  if (existing) {
    await admin
      .from('service_slots')
      .update({ booked_count: (existing.booked_count ?? 0) + 1 })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error: insertError } = await admin
    .from('service_slots')
    .insert({
      community_id: params.communityId,
      slot_type: params.slotType,
      window_start: windowStartIso,
      window_end: windowEndIso,
      capacity: 50,
      booked_count: 1,
    })
    .select('id')
    .single();

  if (!insertError && created) {
    return created.id as string;
  }

  const raced = await findExisting();
  if (raced) {
    await admin
      .from('service_slots')
      .update({ booked_count: (raced.booked_count ?? 0) + 1 })
      .eq('id', raced.id);
    return raced.id;
  }

  throw new Error(insertError?.message || `Failed to reserve ${params.slotType} slot`);
}

async function markOrderReadyForRebook(
  admin: AdminClient,
  orderId: string,
): Promise<void> {
  const { error } = await admin
    .from('orders')
    .update({ status: 'completed' })
    .eq('id', orderId);

  if (error) {
    throw new Error(error.message);
  }

  await admin.from('order_events').insert({
    order_id: orderId,
    status: 'completed',
    note: 'Order closed — customer ready to book again',
    metadata: {},
  });
}

/**
 * Create a customer booking end-to-end (slots + order + events + pickup job).
 * Uses service-role client so RLS does not block rider assignment.
 */
export async function createCustomerBooking(
  admin: AdminClient,
  input: CreateCustomerBookingInput,
): Promise<CreateCustomerBookingResult> {
  const startHour = input.pickupStartHour;
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    return { success: false, error: 'Invalid pickup time slot', status: 400 };
  }

  if (!Number.isInteger(input.dayOffset) || input.dayOffset < 0 || input.dayOffset > 14) {
    return { success: false, error: 'Invalid booking day', status: 400 };
  }

  const pickupStart = new Date(input.pickupWindowStart);
  const pickupEnd = new Date(input.pickupWindowEnd);
  if (Number.isNaN(pickupStart.getTime()) || Number.isNaN(pickupEnd.getTime())) {
    return { success: false, error: 'Invalid pickup window', status: 400 };
  }
  if (pickupEnd.getTime() <= Date.now()) {
    return {
      success: false,
      error: 'This pickup slot has already passed. Please choose another time.',
      status: 409,
    };
  }
  if (pickupEnd.getTime() <= pickupStart.getTime()) {
    return { success: false, error: 'Invalid pickup window', status: 400 };
  }

  const timeZone =
    input.timeZone?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'Asia/Kolkata';

  // Same-day active booking guard (UI usually prevents this; keep for races).
  const { data: existingRows, error: existingError } = await admin
    .from('orders')
    .select(
      `
      id,
      order_number,
      status,
      pickup_slot:pickup_slot_id (window_start)
    `,
    )
    .eq('customer_id', input.customerId)
    .in('status', [...ACTIVE_HOME_STATUSES])
    .order('created_at', { ascending: false })
    .limit(20);

  if (existingError) {
    return { success: false, error: existingError.message, status: 500 };
  }

  const existingForDay = (
    (existingRows as unknown as
      | {
          id: string;
          order_number: string;
          status: string;
          pickup_slot: { window_start: string } | null;
        }[]
      | null) || []
  ).find((row) => {
    const pickup = row.pickup_slot
      ? new Date(row.pickup_slot.window_start)
      : null;
    return isSameZonedDay(pickup, pickupStart, timeZone);
  });

  if (existingForDay) {
    const phase = getHomeOrderPhase(existingForDay.status);
    if (phase !== 'delivered') {
      return {
        success: true,
        orderId: existingForDay.id,
        orderNumber: existingForDay.order_number,
        alreadyExisted: true,
      };
    }
    await markOrderReadyForRebook(admin, existingForDay.id);
  }

  const { data: address, error: addressError } = await admin
    .from('addresses')
    .select('id, community_id')
    .eq('customer_id', input.customerId)
    .eq('is_default', true)
    .maybeSingle();

  if (addressError) {
    return { success: false, error: addressError.message, status: 500 };
  }
  if (!address) {
    return {
      success: false,
      error: 'Please add your address before booking',
      status: 400,
    };
  }

  const { data: slotTemplate, error: slotTemplateError } = await admin
    .from('community_pickup_slots')
    .select('id')
    .eq('community_id', address.community_id)
    .eq('start_hour', startHour)
    .eq('is_active', true)
    .maybeSingle();

  if (slotTemplateError) {
    console.warn('[create-booking] slot template check failed:', slotTemplateError.message);
  }
  if (!slotTemplate) {
    return {
      success: false,
      error: 'Selected pickup slot is not available for your community',
      status: 400,
    };
  }

  const deliveryWindow = getDeliveryWindowFromPickup(pickupStart, pickupEnd);

  const [pickupSlotId, deliverySlotId, assignedRider] = await Promise.all([
    ensureServiceSlot(admin, {
      communityId: address.community_id,
      slotType: 'pickup',
      windowStart: pickupStart,
      windowEnd: pickupEnd,
    }),
    ensureServiceSlot(admin, {
      communityId: address.community_id,
      slotType: 'delivery',
      windowStart: deliveryWindow.start,
      windowEnd: deliveryWindow.end,
    }),
    resolvePickupRiderForCommunity(admin, address.community_id),
  ]);

  if ('error' in assignedRider) {
    return {
      success: false,
      error: assignedRider.error,
      status: assignedRider.status,
    };
  }

  const estimateLines = (input.estimatedGarments || []).filter(
    (line) => line.quantity > 0,
  );
  const estimatedAmount =
    typeof input.estimatedAmount === 'number' && estimateLines.length > 0
      ? input.estimatedAmount
      : estimateLines.reduce(
          (sum, line) => sum + line.quantity * line.unitPrice,
          0,
        );

  const baseOrderPayload = {
    order_number: generateOrderNumber(),
    customer_id: input.customerId,
    address_id: address.id,
    community_id: address.community_id,
    status: 'pickup_assigned' as const,
    pickup_slot_id: pickupSlotId,
    delivery_slot_id: deliverySlotId,
    special_instructions: input.specialInstructions?.trim() || null,
    subtotal: 0,
    total_amount: 0,
  };

  const estimatePayload =
    estimateLines.length > 0
      ? {
          payment_status: 'unpaid',
          estimated_amount: estimatedAmount,
          estimated_garments: estimateLines.map((line) => ({
            service_id: line.serviceId,
            name: line.name,
            quantity: line.quantity,
            unit_price: line.unitPrice,
          })),
        }
      : { payment_status: 'unpaid' };

  let { data: order, error: orderError } = await admin
    .from('orders')
    .insert({ ...baseOrderPayload, ...estimatePayload })
    .select('id, order_number')
    .single();

  if (orderError && /estimated_|payment_status/i.test(orderError.message || '')) {
    console.warn(
      '[create-booking] Estimate columns missing; booking without estimate. Apply migration 010.',
    );
    const retry = await admin
      .from('orders')
      .insert(baseOrderPayload)
      .select('id, order_number')
      .single();
    order = retry.data;
    orderError = retry.error;
  }

  if (orderError || !order) {
    console.error('[create-booking] Order create error:', orderError);
    return {
      success: false,
      error: orderError?.message || 'Failed to create booking',
      status: 500,
    };
  }

  const { error: eventsError } = await admin.from('order_events').insert([
    {
      order_id: order.id,
      status: 'booked',
      note: 'Order booked by customer',
      metadata: {},
    },
    {
      order_id: order.id,
      status: 'pickup_assigned',
      note: 'Pickup partner assigned',
      metadata: {
        rider_id: assignedRider.riderId,
        rider_name: assignedRider.riderName,
        rider_phone: assignedRider.riderPhone,
      },
    },
  ]);

  if (eventsError) {
    console.warn('[create-booking] order_events insert failed:', eventsError.message);
  }

  const { data: existingJob } = await admin
    .from('rider_jobs')
    .select('id')
    .eq('order_id', order.id)
    .eq('job_type', 'pickup')
    .maybeSingle();

  if (!existingJob) {
    const { error: jobError } = await admin.from('rider_jobs').insert({
      order_id: order.id,
      rider_id: assignedRider.riderId,
      job_type: 'pickup',
      status: 'assigned',
      scheduled_start: pickupStart.toISOString(),
      scheduled_end: pickupEnd.toISOString(),
    });

    if (jobError) {
      console.error('[create-booking] rider_jobs insert error:', jobError);
      return {
        success: false,
        error: jobError.message || 'Failed to assign pickup job to rider',
        status: 500,
      };
    }
  }

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.order_number,
    alreadyExisted: false,
  };
}
