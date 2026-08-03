import { IS_MOCK_AUTH, MOCK_USER_ID } from '../../../config/auth';
import { supabase } from '../../../lib/supabase';
import { getApiBaseUrl } from '../../../lib/api';
import { createTtlCache } from '../../../lib/ttl-cache';
import { clearOrdersCache } from '../../orders/services/orders.service';

const MOCK_RIDER_ID = '00000000-0000-0000-0000-000000000002';
const ACTIVE_ORDERS_CACHE_TTL_MS = 15_000;

const RESOLVE_RIDER_TIMEOUT_MS = 15000;

export type HourlyPickupSlot = {
  startHour: number;
  endHour: number;
  label: string;
};

export type CreateBookingInput = {
  dayOffset: number;
  /** Hourly window start (0–23). End is always startHour + 1. */
  pickupStartHour: number;
  specialInstructions?: string;
  estimatedGarments?: {
    serviceId: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
  estimatedAmount?: number;
};

/** Format an hourly window label, e.g. "8:00 AM - 9:00 AM". */
export function formatHourlySlotLabel(startHour: number): string {
  const start = new Date();
  start.setHours(startHour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(startHour + 1, 0, 0, 0);
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return `${start.toLocaleTimeString('en-US', opts)} - ${end.toLocaleTimeString('en-US', opts)}`;
}

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
  estimatedAmount: number | null;
  paymentStatus: 'unpaid' | 'paid' | 'insufficient_funds';
  pickupConfirmNote: string | null;
};

/** @deprecated Use ActiveBooking */
export type AwaitingBooking = ActiveBooking;

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

  // Prefer local session — getUser() hits the network on every call.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) return sessionData.session.user.id;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Pick a pickup rider for the community.
 *
 * Real auth: resolves via Next API (service role) because customers cannot
 * read rider_communities under RLS — otherwise we silently fell back to the
 * mock rider (Rahul).
 *
 * Mock auth: prefers the mock rider when mapped to the community (E2E), else
 * first community rider, else mock fallback.
 */
async function resolvePickupRider(communityId: string): Promise<{
  riderId: string;
  riderName: string;
  riderPhone: string | null;
}> {
  if (!IS_MOCK_AUTH) {
    return resolvePickupRiderViaApi(communityId);
  }

  return resolvePickupRiderClientSide(communityId);
}

async function resolvePickupRiderViaApi(communityId: string): Promise<{
  riderId: string;
  riderName: string;
  riderPhone: string | null;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Please sign in again to book a pickup.');
  }

  const apiBase = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESOLVE_RIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/booking/resolve-pickup-rider`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ communityId }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'AbortError');
    throw new Error(
      aborted
        ? `Could not assign a pickup rider (timed out contacting ${apiBase}). Is web:dev reachable?`
        : `Could not assign a pickup rider (cannot reach ${apiBase}). Check EXPO_PUBLIC_API_URL.`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: {
    error?: string;
    success?: boolean;
    riderId?: string;
    riderName?: string;
    riderPhone?: string | null;
  };

  try {
    payload = await response.json();
  } catch {
    throw new Error('Invalid response while assigning pickup rider.');
  }

  if (!response.ok || !payload.success || !payload.riderId) {
    throw new Error(
      payload.error || 'No rider is assigned to this community. Ask ops to assign one.',
    );
  }

  return {
    riderId: payload.riderId,
    riderName: payload.riderName?.trim() || 'Pickup Partner',
    riderPhone: payload.riderPhone ?? null,
  };
}

async function resolvePickupRiderClientSide(communityId: string): Promise<{
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

  const riderIds = ((links ?? []) as { rider_id: string }[])
    .map((row) => row.rider_id)
    .sort();

  const riderId =
    (riderIds.includes(MOCK_RIDER_ID) ? MOCK_RIDER_ID : null) ??
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

/**
 * Reuse an existing community slot window when present (e.g. after cancel + rebook),
 * otherwise insert. Avoids unique (community_id, slot_type, window_start) conflicts.
 */
async function ensureServiceSlot(params: {
  communityId: string;
  slotType: 'pickup' | 'delivery';
  windowStart: Date;
  windowEnd: Date;
}): Promise<string> {
  const windowStartIso = params.windowStart.toISOString();
  const windowEndIso = params.windowEnd.toISOString();

  const findExisting = async () => {
    const { data, error } = await (supabase
      .from('service_slots') as ReturnType<typeof supabase.from>)
      .select('id, booked_count')
      .eq('community_id', params.communityId)
      .eq('slot_type', params.slotType)
      .eq('window_start', windowStartIso)
      .maybeSingle();

    if (error) {
      console.warn('[Booking] service_slots lookup failed:', error.message);
      return null;
    }
    return data as { id: string; booked_count: number | null } | null;
  };

  const existing = await findExisting();
  if (existing) {
    await (supabase.from('service_slots') as ReturnType<typeof supabase.from>)
      .update({ booked_count: (existing.booked_count ?? 0) + 1 })
      .eq('id', existing.id);
    return existing.id;
  }

  const { data: created, error: insertError } = await (supabase
    .from('service_slots') as ReturnType<typeof supabase.from>)
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
    return (created as { id: string }).id;
  }

  // Concurrent insert or leftover slot from a cancelled order — reuse it.
  const raced = await findExisting();
  if (raced) {
    await (supabase.from('service_slots') as ReturnType<typeof supabase.from>)
      .update({ booked_count: (raced.booked_count ?? 0) + 1 })
      .eq('id', raced.id);
    return raced.id;
  }

  console.error('[Booking] service_slots insert error:', insertError);
  throw new Error(
    insertError?.message || `Failed to reserve ${params.slotType} slot`,
  );
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
  estimated_amount: number | null;
  payment_status: 'unpaid' | 'paid' | 'insufficient_funds' | null;
  customer_rating: number | null;
  customer_feedback: string | null;
  feedback_dismissed_at: string | null;
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
        metadata: {
          rider_name?: string;
          rider_phone?: string;
          estimated_amount?: number;
          final_amount?: number;
          difference?: number;
          reason_lines?: string[];
        } | null;
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
  estimated_amount,
  payment_status,
  customer_rating,
  customer_feedback,
  feedback_dismissed_at,
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

const activeOrdersCache = createTtlCache<OrderRow[]>(ACTIVE_ORDERS_CACHE_TTL_MS);

export function clearActiveBookingCache(): void {
  activeOrdersCache.clear();
}

async function fetchActiveOrderRows(options?: {
  force?: boolean;
}): Promise<OrderRow[]> {
  return activeOrdersCache.getOrFetch(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    const { data, error } = await (supabase
      .from('orders') as ReturnType<typeof supabase.from>)
      .select(ORDER_SELECT)
      .eq('customer_id', userId)
      .in('status', [...ACTIVE_HOME_STATUSES])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[Booking] Fetch active bookings error:', error);
      return [];
    }

    return (data as OrderRow[]) || [];
  }, options?.force === true);
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
    estimatedAmount:
      row.estimated_amount != null ? Number(row.estimated_amount) : null,
    paymentStatus: row.payment_status ?? 'unpaid',
    pickupConfirmNote: pickedUpEvent?.note ?? null,
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
  options?: { force?: boolean },
): Promise<ActiveBooking | null> {
  const rows = await fetchActiveOrderRows(options);
  const match = rows.find((row) => {
    const pickupStart = row.pickup_slot
      ? new Date(row.pickup_slot.window_start)
      : null;
    return isPickupOnDay(pickupStart, dayOffset);
  });

  if (!match) return null;
  return mapOrderToActiveBooking(match);
}

const OUT_FOR_DELIVERY_STATUSES = new Set([
  'delivery_assigned',
  'out_for_delivery',
]);

/**
 * Out-for-delivery booking whose delivery slot falls on today.
 * Independent of the Home date-strip selection.
 */
export async function getTodaysOutForDeliveryBooking(options?: {
  force?: boolean;
}): Promise<ActiveBooking | null> {
  const rows = await fetchActiveOrderRows(options);
  const { start, end } = getDayBounds(0);

  const matches = rows
    .filter((row) => {
      if (!OUT_FOR_DELIVERY_STATUSES.has(row.status)) return false;
      if (!row.delivery_slot?.window_start) return false;
      const deliveryStart = new Date(row.delivery_slot.window_start);
      return deliveryStart >= start && deliveryStart < end;
    })
    .sort((a, b) => {
      const aStart = new Date(a.delivery_slot!.window_start).getTime();
      const bStart = new Date(b.delivery_slot!.window_start).getTime();
      return aStart - bStart;
    });

  if (matches.length === 0) return null;
  return mapOrderToActiveBooking(matches[0]);
}

/**
 * Delivered order today that still needs feedback (not rated, not dismissed).
 * Independent of the Home date-strip selection.
 */
export async function getTodaysDeliveredFeedbackBooking(options?: {
  force?: boolean;
}): Promise<ActiveBooking | null> {
  const rows = await fetchActiveOrderRows(options);
  const { start, end } = getDayBounds(0);

  const matches = rows
    .filter((row) => {
      if (row.status !== 'delivered') return false;
      if (row.customer_rating != null) return false;
      if (row.feedback_dismissed_at) return false;
      if (!row.delivery_slot?.window_start) return false;
      const deliveryStart = new Date(row.delivery_slot.window_start);
      return deliveryStart >= start && deliveryStart < end;
    })
    .sort((a, b) => {
      const aStart = new Date(a.delivery_slot!.window_start).getTime();
      const bStart = new Date(b.delivery_slot!.window_start).getTime();
      return bStart - aStart;
    });

  if (matches.length === 0) return null;
  return mapOrderToActiveBooking(matches[0]);
}

export async function submitOrderFeedback(
  orderId: string,
  rating: number,
  feedback?: string,
): Promise<void> {
  const { error } = await supabase.rpc('submit_order_feedback', {
    p_order_id: orderId,
    p_rating: rating,
    p_feedback: feedback?.trim() ? feedback.trim() : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  clearActiveBookingCache();
  clearOrdersCache();
}

export async function dismissOrderFeedback(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('dismiss_order_feedback', {
    p_order_id: orderId,
  });

  if (error) {
    throw new Error(error.message);
  }

  clearActiveBookingCache();
  clearOrdersCache();
}

/**
 * Day offsets (0 = today) that already have an active pickup booking.
 * Used for indicators on the date strip.
 */
export async function getBookedDayOffsets(
  dayCount = 7,
  options?: { force?: boolean },
): Promise<number[]> {
  const rows = await fetchActiveOrderRows(options);
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

  // Lightweight day conflict check — avoid the full nested home-order select.
  const [{ data: existingRows }, addressResult] = await Promise.all([
    (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .select(
        `
        id,
        order_number,
        status,
        pickup_slot:pickup_slot_id (window_start)
      `,
      )
      .eq('customer_id', userId)
      .in('status', [...ACTIVE_HOME_STATUSES])
      .order('created_at', { ascending: false })
      .limit(20),
    (supabase.from('addresses') as ReturnType<typeof supabase.from>)
      .select('id, community_id')
      .eq('customer_id', userId)
      .eq('is_default', true)
      .single(),
  ]);

  const existingForDay = (
    (existingRows as
      | {
          id: string;
          order_number: string;
          status: string;
          pickup_slot: { window_start: string } | null;
        }[]
      | null) || []
  ).find((row) => {
    const pickupStart = row.pickup_slot
      ? new Date(row.pickup_slot.window_start)
      : null;
    return isPickupOnDay(pickupStart, input.dayOffset);
  });

  if (existingForDay) {
    const phase = getHomeOrderPhase(existingForDay.status);
    if (phase !== 'delivered') {
      return {
        orderId: existingForDay.id,
        orderNumber: existingForDay.order_number,
      };
    }
    await markOrderReadyForRebook(existingForDay.id);
  }

  const { data: address, error: addressError } = addressResult;
  if (addressError || !address) {
    throw new Error('Please add your address before booking');
  }

  const addressRow = address as { id: string; community_id: string };
  const startHour = input.pickupStartHour;
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new Error('Invalid pickup time slot');
  }

  const { data: slotTemplate, error: slotTemplateError } = await (supabase
    .from('community_pickup_slots') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('community_id', addressRow.community_id)
    .eq('start_hour', startHour)
    .eq('is_active', true)
    .maybeSingle();

  if (slotTemplateError) {
    console.warn('[Booking] slot template check failed:', slotTemplateError.message);
  }
  if (!slotTemplate) {
    throw new Error('Selected pickup slot is not available for your community');
  }

  const pickupWindow = buildWindow(input.dayOffset, startHour, startHour + 1);
  if (pickupWindow.end.getTime() <= Date.now()) {
    throw new Error(
      'This pickup slot has already passed. Please choose another time.',
    );
  }
  // Delivery is always 24 hours after pickup
  const deliveryWindow = getDeliveryWindowFromPickup(
    pickupWindow.start,
    pickupWindow.end,
  );

  // Slots + rider are independent — run together (was 3 sequential round-trips).
  const [pickupSlotId, deliverySlotId, assignedRider] = await Promise.all([
    ensureServiceSlot({
      communityId: addressRow.community_id,
      slotType: 'pickup',
      windowStart: pickupWindow.start,
      windowEnd: pickupWindow.end,
    }),
    ensureServiceSlot({
      communityId: addressRow.community_id,
      slotType: 'delivery',
      windowStart: deliveryWindow.start,
      windowEnd: deliveryWindow.end,
    }),
    resolvePickupRider(addressRow.community_id),
  ]);

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
    customer_id: userId,
    address_id: addressRow.id,
    community_id: addressRow.community_id,
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

  let { data: order, error: orderError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .insert({ ...baseOrderPayload, ...estimatePayload })
    .select('id, order_number')
    .single();

  // Migration 010 not applied yet — book without estimate columns
  if (
    orderError &&
    /estimated_|payment_status/i.test(orderError.message || '')
  ) {
    console.warn(
      '[Booking] Estimate columns missing; booking without estimate. Apply migration 010.',
    );
    const retry = await (supabase
      .from('orders') as ReturnType<typeof supabase.from>)
      .insert(baseOrderPayload)
      .select('id, order_number')
      .single();
    order = retry.data;
    orderError = retry.error;
  }

  if (orderError || !order) {
    console.error('[Booking] Order create error:', orderError);
    throw new Error(orderError?.message || 'Failed to create booking');
  }

  const orderRow = order as { id: string; order_number: string };

  // Events + rider job can run together; job API reuses the already-resolved rider.
  await Promise.all([
    (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert([
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
    ]),
    ensurePickupJob({
      orderId: orderRow.id,
      riderId: assignedRider.riderId,
      scheduledStart: pickupWindow.start.toISOString(),
      scheduledEnd: pickupWindow.end.toISOString(),
    }),
  ]);

  clearActiveBookingCache();
  clearOrdersCache();

  return {
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
  };
}

async function ensurePickupJob(params: {
  orderId: string;
  riderId: string;
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<void> {
  if (!IS_MOCK_AUTH) {
    await ensurePickupJobViaApi(params);
    return;
  }

  const { error } = await (supabase.from('rider_jobs') as ReturnType<typeof supabase.from>).insert({
    order_id: params.orderId,
    rider_id: params.riderId,
    job_type: 'pickup',
    status: 'assigned',
    scheduled_start: params.scheduledStart,
    scheduled_end: params.scheduledEnd,
  });

  if (error) {
    console.error('[Booking] rider_jobs insert error:', error);
    throw new Error(error.message || 'Failed to assign pickup job to rider');
  }
}

async function ensurePickupJobViaApi(params: {
  orderId: string;
  riderId: string;
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Please sign in again to complete booking.');
  }

  const apiBase = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESOLVE_RIDER_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/booking/ensure-pickup-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        orderId: params.orderId,
        riderId: params.riderId,
        scheduledStart: params.scheduledStart,
        scheduledEnd: params.scheduledEnd,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'AbortError');
    throw new Error(
      aborted
        ? `Could not assign rider job (timed out contacting ${apiBase}).`
        : `Could not assign rider job (cannot reach ${apiBase}).`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: { error?: string; success?: boolean };
  try {
    payload = await response.json();
  } catch {
    throw new Error('Invalid response while assigning rider job.');
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to assign pickup job to rider.');
  }
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

  clearActiveBookingCache();
  clearOrdersCache();
}

const CANCEL_TIMEOUT_MS = 15000;

const CANCELLABLE_STATUSES = [
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
] as const;

/**
 * Cancel a pre-pickup booking so home returns to the slot picker.
 * Prefer DB RPC (works without apps/web). Fall back to Next API, then mock client path.
 */
export async function cancelBooking(orderId: string): Promise<void> {
  if (IS_MOCK_AUTH) {
    return cancelBookingClientSide(orderId);
  }

  try {
    await cancelBookingViaRpc(orderId);
    return;
  } catch (rpcError) {
    try {
      await cancelBookingViaApi(orderId);
      return;
    } catch {
      throw rpcError instanceof Error
        ? rpcError
        : new Error('Failed to cancel booking.');
    }
  }
}

async function cancelBookingViaRpc(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_customer_order', {
    p_order_id: orderId,
    p_reason: 'Cancelled by customer',
  });

  if (error) {
    throw new Error(error.message || 'Failed to cancel booking.');
  }

  clearActiveBookingCache();
  clearOrdersCache();
}

async function cancelBookingViaApi(orderId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Please sign in again to cancel this booking.');
  }

  const apiBase = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CANCEL_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/booking/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ orderId }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'AbortError');
    throw new Error(
      aborted
        ? `Cancel timed out contacting ${apiBase}. Is web:dev reachable?`
        : `Cannot reach cancel server (${apiBase}). Check EXPO_PUBLIC_API_URL.`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: { error?: string; success?: boolean };
  try {
    payload = await response.json();
  } catch {
    throw new Error('Invalid response while cancelling booking.');
  }

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Failed to cancel booking.');
  }

  clearActiveBookingCache();
  clearOrdersCache();
}

async function cancelBookingClientSide(orderId: string): Promise<void> {
  const { data: order, error: fetchError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const status = (order as { status?: string } | null)?.status;
  if (
    !status ||
    !CANCELLABLE_STATUSES.includes(status as (typeof CANCELLABLE_STATUSES)[number])
  ) {
    throw new Error(
      'This booking can no longer be cancelled. Pickup may already be underway or complete.',
    );
  }

  const { error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .update({ status: 'cancelled' })
    .eq('id', orderId);

  if (error) {
    throw new Error(error.message);
  }

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'cancelled',
    note: 'Cancelled by customer',
    metadata: {},
  });

  await (supabase.from('rider_jobs') as ReturnType<typeof supabase.from>)
    .update({
      status: 'failed',
      failure_reason: 'Customer cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .in('status', ['assigned', 'in_progress']);

  clearActiveBookingCache();
  clearOrdersCache();
}
