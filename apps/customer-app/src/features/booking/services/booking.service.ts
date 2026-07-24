import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const MOCK_RIDER_ID = '00000000-0000-0000-0000-000000000002';

export type SlotKey = 'morning' | 'afternoon' | 'evening';

const PICKUP_HOURS: Record<SlotKey, { start: number; end: number; label: string }> = {
  morning: { start: 8, end: 11, label: '8:00 AM - 11:00 AM' },
  afternoon: { start: 11, end: 15, label: '11:00 AM - 3:00 PM' },
  evening: { start: 15, end: 19, label: '3:00 PM - 7:00 PM' },
};

const AWAITING_STATUSES = ['booked', 'pickup_assigned', 'pickup_in_progress'] as const;

/** Shown on home until customer books again */
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

export type HomeOrderPhase = 'awaiting_pickup' | 'picked_up' | 'delivered';

export type BookingGarment = {
  id: string;
  garmentName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type ActiveBooking = {
  orderId: string;
  orderNumber: string;
  status: string;
  phase: HomeOrderPhase;
  statusLabel: string;
  statusDescription: string;
  specialInstructions: string | null;
  pickupDateLabel: string;
  pickupTimeLabel: string;
  deliveryDateLabel: string;
  deliveryTimeLabel: string;
  addressName: string;
  addressDetail: string;
  partnerLabel: string;
  riderName: string | null;
  riderPhone: string | null;
  riderRating: number | null;
  riderAssigned: boolean;
  /** True once rider has completed pickup and garments are recorded */
  isPickupComplete: boolean;
  items: BookingGarment[];
  totalItemCount: number;
  totalAmount: number;
};

/** @deprecated Use ActiveBooking */
export type AwaitingBooking = ActiveBooking;

export type CreateBookingInput = {
  dayOffset: number;
  pickupSlot: SlotKey;
  specialInstructions?: string;
};

/** Delivery is always 24 hours after pickup. */
export function getDeliveryWindowFromPickup(pickupStart: Date, pickupEnd: Date) {
  const start = new Date(pickupStart);
  start.setTime(start.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(pickupEnd);
  end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

async function getCurrentUserId(): Promise<string | null> {
  if (IS_MOCK_AUTH) return MOCK_USER_ID;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Pick a pickup rider for the community.
 * Prefers the mock rider when mapped (keeps customer↔rider E2E working),
 * otherwise the first community-assigned rider, else mock fallback.
 */
async function resolvePickupRider(communityId: string): Promise<{
  riderId: string;
  riderName: string;
  riderPhone: string | null;
}> {
  const { data: links, error } = await (supabase
    .from('rider_communities') as ReturnType<typeof supabase.from>)
    .select('rider_id')
    .eq('community_id', communityId);

  if (error) {
    console.warn('[Booking] rider_communities lookup failed:', error.message);
  }

  const riderIds = ((links ?? []) as { rider_id: string }[]).map((row) => row.rider_id);

  const riderId =
    (IS_MOCK_AUTH && riderIds.includes(MOCK_RIDER_ID) ? MOCK_RIDER_ID : null) ??
    riderIds[0] ??
    MOCK_RIDER_ID;

  const { data: profile } = await (supabase
    .from('profiles') as ReturnType<typeof supabase.from>)
    .select('full_name, phone')
    .eq('id', riderId)
    .maybeSingle();

  const profileRow = profile as { full_name: string | null; phone: string | null } | null;

  return {
    riderId,
    riderName: profileRow?.full_name?.trim() || 'Pickup Partner',
    riderPhone: profileRow?.phone ?? null,
  };
}

function buildWindow(dayOffset: number, startHour: number, endHour: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(start);
  end.setHours(endHour, 0, 0, 0);

  return { start, end };
}

function formatDateLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);

  const isToday = compare.getTime() === today.getTime();
  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return isToday ? `Today, ${formatted}` : formatted;
}

function formatTimeLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return `${start.toLocaleTimeString('en-US', opts)} - ${end.toLocaleTimeString('en-US', opts)}`;
}

export function getHomeOrderPhase(status: string): HomeOrderPhase {
  if (AWAITING_STATUSES.includes(status as (typeof AWAITING_STATUSES)[number])) {
    return 'awaiting_pickup';
  }
  if (status === 'delivered') {
    return 'delivered';
  }
  return 'picked_up';
}

function statusLabel(status: string, phase: HomeOrderPhase): string {
  if (phase === 'awaiting_pickup') {
    return status === 'pickup_in_progress' ? 'Pickup In Progress' : 'Awaiting Pickup';
  }
  if (phase === 'delivered') return 'Delivered';
  if (['ready_for_delivery', 'delivery_assigned', 'out_for_delivery'].includes(status)) {
    return 'Out for Delivery';
  }
  return 'Picked Up';
}

function statusDescription(
  status: string,
  phase: HomeOrderPhase,
  pickupTimeLabel: string,
): string {
  if (phase === 'awaiting_pickup') {
    return status === 'pickup_in_progress'
      ? 'Your pickup partner is on the way to your address.'
      : `Our partner will arrive today between ${pickupTimeLabel}.`;
  }
  if (phase === 'delivered') {
    return 'Your clothes have been delivered. Thanks for choosing Iron Cloud!';
  }
  if (['ready_for_delivery', 'delivery_assigned', 'out_for_delivery'].includes(status)) {
    return 'Your clean clothes are on the way to your address.';
  }
  return 'Your clothes have been picked up.';
}

function partnerLabel(status: string, phase: HomeOrderPhase): string {
  if (phase === 'awaiting_pickup') return 'Pickup Partner';
  if (['ready_for_delivery', 'delivery_assigned', 'out_for_delivery', 'delivered'].includes(status)) {
    return 'Delivery Partner';
  }
  return 'Pickup Partner';
}

function isPickupCompleteStatus(status: string): boolean {
  return !AWAITING_STATUSES.includes(status as (typeof AWAITING_STATUSES)[number]);
}

function formatSingleTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function resolveScheduleLabels(
  phase: HomeOrderPhase,
  pickupStart: Date | null,
  pickupEnd: Date | null,
  deliveryStart: Date | null,
  deliveryEnd: Date | null,
  pickedUpAt: Date | null,
  deliveredAt: Date | null,
) {
  const pickupDateLabel = pickupStart ? formatDateLabel(pickupStart) : 'Scheduled';
  const deliveryDateLabel = deliveryStart ? formatDateLabel(deliveryStart) : 'Scheduled';

  let pickupTimeLabel =
    pickupStart && pickupEnd
      ? formatTimeLabel(pickupStart, pickupEnd)
      : 'To be confirmed';
  let deliveryTimeLabel =
    deliveryStart && deliveryEnd
      ? formatTimeLabel(deliveryStart, deliveryEnd)
      : 'To be confirmed';

  if (phase !== 'awaiting_pickup' && pickedUpAt) {
    pickupTimeLabel = formatSingleTime(pickedUpAt);
  }

  if (phase === 'delivered' && deliveredAt) {
    deliveryTimeLabel = formatSingleTime(deliveredAt);
  }

  return {
    pickupDateLabel,
    pickupTimeLabel,
    deliveryDateLabel,
    deliveryTimeLabel,
  };
}

function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `IC${y}${m}${d}${rand}`.slice(0, 12);
}

function getDayBounds(dayOffset: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function isPickupOnDay(pickupStart: Date | null, dayOffset: number): boolean {
  if (!pickupStart) return false;
  const { start, end } = getDayBounds(dayOffset);
  return pickupStart >= start && pickupStart < end;
}

/** Local calendar day offset from today for a pickup timestamp (null if outside 0..dayCount-1). */
export function pickupDayOffset(pickupIso: string, dayCount = 7): number | null {
  const pickup = new Date(pickupIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(pickup);
  compare.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (compare.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diff < 0 || diff >= dayCount) return null;
  return diff;
}

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  special_instructions: string | null;
  total_amount: number;
  pickup_slot: { window_start: string; window_end: string } | null;
  delivery_slot: { window_start: string; window_end: string } | null;
  address: {
    tower: string | null;
    flat_number: string;
    community: { name: string } | null;
  } | null;
  order_events:
    | {
        status: string;
        metadata: { rider_name?: string; rider_phone?: string } | null;
        note: string | null;
        created_at: string;
      }[]
    | null;
  order_items:
    | {
        id: string;
        quantity: number;
        unit_price: number;
        service: { name: string } | null;
      }[]
    | null;
};

const ORDER_SELECT = `
  id,
  order_number,
  status,
  special_instructions,
  total_amount,
  pickup_slot:pickup_slot_id (window_start, window_end),
  delivery_slot:delivery_slot_id (window_start, window_end),
  address:address_id (tower, flat_number, community:community_id (name)),
  order_events (status, metadata, note, created_at),
  order_items (
    id,
    quantity,
    unit_price,
    service:service_id (name)
  )
`;

async function fetchActiveOrderRows(): Promise<OrderRow[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select(ORDER_SELECT)
    .eq('customer_id', userId)
    .in('status', [...ACTIVE_HOME_STATUSES])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Booking] Fetch active bookings error:', error);
    return [];
  }

  return (data as OrderRow[]) || [];
}

async function mapOrderToActiveBooking(row: OrderRow): Promise<ActiveBooking> {
  const pickupStart = row.pickup_slot ? new Date(row.pickup_slot.window_start) : null;
  const pickupEnd = row.pickup_slot ? new Date(row.pickup_slot.window_end) : null;
  const deliveryStart = row.delivery_slot
    ? new Date(row.delivery_slot.window_start)
    : null;
  const deliveryEnd = row.delivery_slot
    ? new Date(row.delivery_slot.window_end)
    : null;

  const assignmentEvent = (row.order_events || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .find((event) => event.metadata?.rider_name || event.metadata?.rider_phone);

  const pickedUpEvent = (row.order_events || []).find(
    (event) => event.status === 'picked_up',
  );
  const deliveredEvent = (row.order_events || []).find(
    (event) => event.status === 'delivered',
  );

  const phase = getHomeOrderPhase(row.status);
  const useDeliveryPartner = [
    'ready_for_delivery',
    'delivery_assigned',
    'out_for_delivery',
    'delivered',
  ].includes(row.status);
  const jobType = useDeliveryPartner ? 'delivery' : 'pickup';

  let riderName = assignmentEvent?.metadata?.rider_name ?? null;
  let riderPhone = assignmentEvent?.metadata?.rider_phone ?? null;
  let riderRating: number | null = null;

  const { data: job } = await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .select(
      `
      rider:rider_id (
        rating_avg,
        profiles:id (full_name, phone)
      )
    `,
    )
    .eq('order_id', row.id)
    .eq('job_type', jobType)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const riderRow = job as {
    rider: {
      rating_avg: number | null;
      profiles: { full_name: string | null; phone: string | null } | null;
    } | null;
  } | null;

  if (riderRow?.rider?.profiles) {
    riderName = riderRow.rider.profiles.full_name ?? riderName;
    riderPhone = riderRow.rider.profiles.phone ?? riderPhone;
    riderRating =
      riderRow.rider.rating_avg != null ? Number(riderRow.rider.rating_avg) : null;
  }

  if (!riderName && !useDeliveryPartner) {
    const { data: pickupJob } = await (supabase
      .from('rider_jobs') as ReturnType<typeof supabase.from>)
      .select(
        `
        rider:rider_id (
          rating_avg,
          profiles:id (full_name, phone)
        )
      `,
      )
      .eq('order_id', row.id)
      .eq('job_type', 'pickup')
      .limit(1)
      .maybeSingle();

    const pickupRider = (
      pickupJob as {
        rider: {
          rating_avg: number | null;
          profiles: { full_name: string | null; phone: string | null } | null;
        } | null;
      } | null
    )?.rider;

    if (pickupRider?.profiles) {
      riderName = pickupRider.profiles.full_name ?? riderName;
      riderPhone = pickupRider.profiles.phone ?? riderPhone;
      riderRating =
        pickupRider.rating_avg != null
          ? Number(pickupRider.rating_avg)
          : riderRating;
    }
  }

  const communityName = row.address?.community?.name || 'Your community';
  const tower = row.address?.tower ? `Tower ${row.address.tower}` : null;
  const flat = row.address?.flat_number
    ? `Flat ${row.address.flat_number}`
    : null;

  const items: BookingGarment[] = (row.order_items || []).map((item) => {
    const quantity = item.quantity || 0;
    const unitPrice = Number(item.unit_price || 0);
    return {
      id: item.id,
      garmentName: item.service?.name || 'Garment',
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });

  const pickupComplete = isPickupCompleteStatus(row.status);
  const pickedUpAt = pickedUpEvent ? new Date(pickedUpEvent.created_at) : null;
  const deliveredAt = deliveredEvent ? new Date(deliveredEvent.created_at) : null;

  const schedule = resolveScheduleLabels(
    phase,
    pickupStart,
    pickupEnd,
    deliveryStart,
    deliveryEnd,
    pickedUpAt,
    deliveredAt,
  );

  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    orderId: row.id,
    orderNumber: row.order_number,
    status: row.status,
    phase,
    statusLabel: statusLabel(row.status, phase),
    statusDescription: statusDescription(
      row.status,
      phase,
      schedule.pickupTimeLabel,
    ),
    specialInstructions: row.special_instructions,
    pickupDateLabel: schedule.pickupDateLabel,
    pickupTimeLabel: schedule.pickupTimeLabel,
    deliveryDateLabel: schedule.deliveryDateLabel,
    deliveryTimeLabel: schedule.deliveryTimeLabel,
    addressName: communityName,
    addressDetail: [tower, flat].filter(Boolean).join(' • ') || 'Address on file',
    partnerLabel: partnerLabel(row.status, phase),
    riderName,
    riderPhone,
    riderRating,
    riderAssigned: !!(riderName || riderPhone),
    isPickupComplete: pickupComplete,
    items,
    totalItemCount,
    totalAmount:
      Number(row.total_amount || 0) ||
      items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

/**
 * Returns true if customer has an active booking for a given day (or any day).
 */
export async function hasAwaitingPickupBooking(dayOffset?: number): Promise<boolean> {
  if (typeof dayOffset === 'number') {
    const booking = await getHomeBookingForDay(dayOffset);
    return !!booking;
  }
  const booking = await getActiveHomeBooking();
  return !!booking;
}

/** @deprecated Use getHomeBookingForDay */
export async function getAwaitingPickupBooking(): Promise<ActiveBooking | null> {
  return getActiveHomeBooking();
}

/**
 * Booking for a specific calendar day (by pickup slot date).
 * Each day is independent — other days' orders do not appear here.
 */
export async function getHomeBookingForDay(
  dayOffset: number,
): Promise<ActiveBooking | null> {
  const rows = await fetchActiveOrderRows();
  const match = rows.find((row) => {
    const pickupStart = row.pickup_slot
      ? new Date(row.pickup_slot.window_start)
      : null;
    return isPickupOnDay(pickupStart, dayOffset);
  });

  if (!match) return null;
  return mapOrderToActiveBooking(match);
}

/**
 * Day offsets (0 = today) that already have an active pickup booking.
 * Used for indicators on the date strip.
 */
export async function getBookedDayOffsets(dayCount = 7): Promise<number[]> {
  const rows = await fetchActiveOrderRows();
  const offsets = new Set<number>();

  for (const row of rows) {
    if (!row.pickup_slot?.window_start) continue;
    const offset = pickupDayOffset(row.pickup_slot.window_start, dayCount);
    if (offset != null) offsets.add(offset);
  }

  return [...offsets].sort((a, b) => a - b);
}

/**
 * Latest active booking across all days (legacy helper).
 */
export async function getActiveHomeBooking(): Promise<ActiveBooking | null> {
  const rows = await fetchActiveOrderRows();
  if (rows.length === 0) return null;
  return mapOrderToActiveBooking(rows[0]);
}

/**
 * Create a booking from home screen selections.
 */
export async function createBooking(input: CreateBookingInput): Promise<{
  orderId: string;
  orderNumber: string;
}> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  // Only block if this day already has an active (non-delivered) booking
  const existingForDay = await getHomeBookingForDay(input.dayOffset);
  if (existingForDay) {
    if (existingForDay.phase !== 'delivered') {
      return {
        orderId: existingForDay.orderId,
        orderNumber: existingForDay.orderNumber,
      };
    }
    await markOrderReadyForRebook(existingForDay.orderId);
  }

  const { data: address, error: addressError } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .select('id, community_id')
    .eq('customer_id', userId)
    .eq('is_default', true)
    .single();

  if (addressError || !address) {
    throw new Error('Please add your address before booking');
  }

  const addressRow = address as { id: string; community_id: string };
  const pickupHours = PICKUP_HOURS[input.pickupSlot];
  const pickupWindow = buildWindow(
    input.dayOffset,
    pickupHours.start,
    pickupHours.end,
  );
  // Delivery is always 24 hours after pickup
  const deliveryWindow = getDeliveryWindowFromPickup(
    pickupWindow.start,
    pickupWindow.end,
  );

  const { data: pickupSlot, error: pickupSlotError } = await (supabase
    .from('service_slots') as ReturnType<typeof supabase.from>)
    .insert({
      community_id: addressRow.community_id,
      slot_type: 'pickup',
      window_start: pickupWindow.start.toISOString(),
      window_end: pickupWindow.end.toISOString(),
      capacity: 50,
      booked_count: 1,
    })
    .select('id')
    .single();

  if (pickupSlotError || !pickupSlot) {
    console.error('[Booking] Pickup slot error:', pickupSlotError);
    throw new Error(pickupSlotError?.message || 'Failed to reserve pickup slot');
  }

  const { data: deliverySlot, error: deliverySlotError } = await (supabase
    .from('service_slots') as ReturnType<typeof supabase.from>)
    .insert({
      community_id: addressRow.community_id,
      slot_type: 'delivery',
      window_start: deliveryWindow.start.toISOString(),
      window_end: deliveryWindow.end.toISOString(),
      capacity: 50,
      booked_count: 1,
    })
    .select('id')
    .single();

  if (deliverySlotError || !deliverySlot) {
    console.error('[Booking] Delivery slot error:', deliverySlotError);
    throw new Error(deliverySlotError?.message || 'Failed to reserve delivery slot');
  }

  const orderNumber = generateOrderNumber();
  const assignedRider = await resolvePickupRider(addressRow.community_id);

  const { data: order, error: orderError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .insert({
      order_number: orderNumber,
      customer_id: userId,
      address_id: addressRow.id,
      community_id: addressRow.community_id,
      status: 'pickup_assigned',
      pickup_slot_id: (pickupSlot as { id: string }).id,
      delivery_slot_id: (deliverySlot as { id: string }).id,
      special_instructions: input.specialInstructions?.trim() || null,
      subtotal: 0,
      total_amount: 0,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('[Booking] Order create error:', orderError);
    throw new Error(orderError?.message || 'Failed to create booking');
  }

  const orderRow = order as { id: string; order_number: string };

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert([
    {
      order_id: orderRow.id,
      status: 'booked',
      note: 'Order booked by customer',
      metadata: {},
    },
    {
      order_id: orderRow.id,
      status: 'pickup_assigned',
      note: 'Pickup partner assigned',
      metadata: {
        rider_id: assignedRider.riderId,
        rider_name: assignedRider.riderName,
        rider_phone: assignedRider.riderPhone,
      },
    },
  ]);

  await (supabase.from('rider_jobs') as ReturnType<typeof supabase.from>).insert({
    order_id: orderRow.id,
    rider_id: assignedRider.riderId,
    job_type: 'pickup',
    status: 'assigned',
    scheduled_start: pickupWindow.start.toISOString(),
    scheduled_end: pickupWindow.end.toISOString(),
  });

  return {
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
  };
}

/** Marks a delivered order complete so the customer can book again. */
export async function markOrderReadyForRebook(orderId: string): Promise<void> {
  const { error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .update({ status: 'completed' })
    .eq('id', orderId);

  if (error) {
    throw new Error(error.message);
  }

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'completed',
    note: 'Order closed — customer ready to book again',
    metadata: {},
  });
}

export { PICKUP_HOURS };
