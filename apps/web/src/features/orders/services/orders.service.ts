import type { OrderStatus, PaymentMethod } from '@ironcloud/db';
import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

export type OrderListColumnFilters = {
  customer?: string;
  phone?: string;
  address?: string;
  amount?: string;
  rider?: string;
  pickupRider?: string;
  deliveryRider?: string;
  rating?: string;
  feedback?: string;
  instructions?: string;
  /** YYYY-MM-DD — single calendar day for pickup slot */
  pickupDate?: string;
  /** YYYY-MM-DD — single calendar day for delivery slot */
  deliveryDate?: string;
  /** YYYY-MM-DD — single calendar day for booked (created_at) */
  bookedDate?: string;
};

export type OrderListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrderStatus | OrderStatus[];
  communityId?: string | string[];
  paymentMethod?: PaymentMethod | PaymentMethod[];
  /**
   * Filter by pickup slot window (not booking created_at).
   * Prefer dateFrom/dateTo for ranges; `date` is a single-day shorthand.
   */
  date?: Date;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  columnFilters?: OrderListColumnFilters;
  sortKey?: string;
  sortAsc?: boolean;
};

function asFilterList<T extends string>(value?: T | T[]): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function parseLocalDay(isoDate: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const start = new Date(y, mo, d, 0, 0, 0, 0);
  const end = new Date(y, mo, d, 23, 59, 59, 999);
  if (Number.isNaN(start.getTime())) return null;
  return { start, end };
}

function intersectIds(
  current: string[] | null,
  next: string[],
): string[] | null {
  if (current == null) return next;
  const set = new Set(next);
  return current.filter((id) => set.has(id));
}

async function resolveSlotIds(
  supabase: ReturnType<typeof getSupabase>,
  rangeStart: Date | null,
  rangeEnd: Date | null,
): Promise<{ ids: string[] | null; error: unknown }> {
  if (!rangeStart && !rangeEnd) return { ids: null, error: null };
  let slotsQuery = supabase.from('service_slots').select('id');
  if (rangeStart) {
    slotsQuery = slotsQuery.gte('window_start', rangeStart.toISOString());
  }
  if (rangeEnd) {
    slotsQuery = slotsQuery.lte('window_start', rangeEnd.toISOString());
  }
  const { data: slots, error } = await slotsQuery;
  if (error) return { ids: null, error };
  return { ids: (slots ?? []).map((s) => s.id), error: null };
}

async function resolveCustomerIds(
  supabase: ReturnType<typeof getSupabase>,
  customer?: string,
  phone?: string,
): Promise<{ ids: string[] | null; empty: boolean; error: unknown }> {
  const nameQ = customer?.trim();
  const phoneQ = phone?.trim();
  if (!nameQ && !phoneQ) return { ids: null, empty: false, error: null };

  let q = supabase.from('profiles').select('id');
  if (nameQ) q = q.ilike('full_name', `%${nameQ}%`);
  if (phoneQ) q = q.ilike('phone', `%${phoneQ}%`);
  const { data, error } = await q;
  if (error) return { ids: null, empty: true, error };
  const ids = (data ?? []).map((r) => r.id);
  return { ids, empty: ids.length === 0, error: null };
}

async function resolveAddressIds(
  supabase: ReturnType<typeof getSupabase>,
  address?: string,
): Promise<{ ids: string[] | null; empty: boolean; error: unknown }> {
  const qText = address?.trim();
  if (!qText) return { ids: null, empty: false, error: null };

  const { data, error } = await supabase
    .from('addresses')
    .select('id')
    .or(`flat_number.ilike.%${qText}%,tower.ilike.%${qText}%`);
  if (error) return { ids: null, empty: true, error };
  const ids = (data ?? []).map((r) => r.id);
  return { ids, empty: ids.length === 0, error: null };
}

async function resolveOrderIdsByRiderName(
  supabase: ReturnType<typeof getSupabase>,
  name: string,
  jobType?: 'pickup' | 'delivery',
): Promise<{ ids: string[] | null; empty: boolean; error: unknown }> {
  const qText = name.trim();
  if (!qText) return { ids: null, empty: false, error: null };

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('full_name', `%${qText}%`);
  if (profileError) return { ids: null, empty: true, error: profileError };
  const riderIds = (profiles ?? []).map((p) => p.id);
  if (riderIds.length === 0) return { ids: [], empty: true, error: null };

  let jobsQuery = supabase
    .from('rider_jobs')
    .select('order_id')
    .in('rider_id', riderIds);
  if (jobType) jobsQuery = jobsQuery.eq('job_type', jobType);
  const { data: jobs, error: jobsError } = await jobsQuery;
  if (jobsError) return { ids: null, empty: true, error: jobsError };
  const ids = [...new Set((jobs ?? []).map((j) => j.order_id))];
  return { ids, empty: ids.length === 0, error: null };
}

export const fetchOrders = async (params: OrderListParams) => {
  const supabase = getSupabase();
  const {
    page,
    pageSize,
    search,
    status,
    communityId,
    paymentMethod,
    date,
    dateFrom,
    dateTo,
    columnFilters,
    sortKey = 'created_at',
    sortAsc = false,
  } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const rangeStart = dateFrom ?? (date ? startOfDay(date) : null);
  const rangeEnd = dateTo ?? (date ? endOfDay(date) : null);
  const cols = columnFilters ?? {};

  // Nested embed filters do not constrain parent rows (left join). Resolve ids first.
  let pickupSlotIds: string[] | null = null;
  {
    const { ids, error } = await resolveSlotIds(supabase, rangeStart, rangeEnd);
    if (error) {
      console.error('[fetchOrders] service_slots', (error as { message?: string }).message);
      return { data: [], total: 0, error };
    }
    pickupSlotIds = ids;
    if (pickupSlotIds && pickupSlotIds.length === 0) {
      return { data: [], total: 0, error: null };
    }
  }

  if (cols.pickupDate?.trim()) {
    const day = parseLocalDay(cols.pickupDate);
    if (day) {
      const { ids, error } = await resolveSlotIds(supabase, day.start, day.end);
      if (error) {
        console.error('[fetchOrders] pickupDate slots', (error as { message?: string }).message);
        return { data: [], total: 0, error };
      }
      pickupSlotIds = intersectIds(pickupSlotIds, ids ?? []);
      if (pickupSlotIds && pickupSlotIds.length === 0) {
        return { data: [], total: 0, error: null };
      }
    }
  }

  let deliverySlotIds: string[] | null = null;
  if (cols.deliveryDate?.trim()) {
    const day = parseLocalDay(cols.deliveryDate);
    if (day) {
      const { ids, error } = await resolveSlotIds(supabase, day.start, day.end);
      if (error) {
        console.error('[fetchOrders] deliveryDate slots', (error as { message?: string }).message);
        return { data: [], total: 0, error };
      }
      deliverySlotIds = ids;
      if (deliverySlotIds && deliverySlotIds.length === 0) {
        return { data: [], total: 0, error: null };
      }
    }
  }

  const customers = await resolveCustomerIds(
    supabase,
    cols.customer,
    cols.phone,
  );
  if (customers.error) {
    console.error('[fetchOrders] profiles', (customers.error as { message?: string }).message);
    return { data: [], total: 0, error: customers.error };
  }
  if (customers.empty) return { data: [], total: 0, error: null };

  const addresses = await resolveAddressIds(supabase, cols.address);
  if (addresses.error) {
    console.error('[fetchOrders] addresses', (addresses.error as { message?: string }).message);
    return { data: [], total: 0, error: addresses.error };
  }
  if (addresses.empty) return { data: [], total: 0, error: null };

  let orderIdsFilter: string[] | null = null;
  for (const [name, jobType] of [
    [cols.rider, undefined],
    [cols.pickupRider, 'pickup' as const],
    [cols.deliveryRider, 'delivery' as const],
  ] as const) {
    if (!name?.trim()) continue;
    const riders = await resolveOrderIdsByRiderName(
      supabase,
      name,
      jobType,
    );
    if (riders.error) {
      console.error('[fetchOrders] rider_jobs', (riders.error as { message?: string }).message);
      return { data: [], total: 0, error: riders.error };
    }
    if (riders.empty) return { data: [], total: 0, error: null };
    orderIdsFilter = intersectIds(orderIdsFilter, riders.ids ?? []);
    if (orderIdsFilter && orderIdsFilter.length === 0) {
      return { data: [], total: 0, error: null };
    }
  }

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, status, total_amount, created_at, payment_method, pickup_slot_id, delivery_slot_id, community_id,
      customer_rating, customer_feedback, feedback_dismissed_at, special_instructions,
      profiles!orders_customer_id_fkey(full_name, phone),
      communities(name),
      addresses(flat_number, tower),
      pickup_slot:service_slots!pickup_slot_id(window_start, window_end),
      delivery_slot:service_slots!delivery_slot_id(window_start, window_end),
      rider_jobs(
        id, job_type, status, scheduled_start, scheduled_end,
        riders(id, profiles!riders_id_fkey(full_name, phone))
      )
    `, { count: 'exact' });

  const statuses = asFilterList(status);
  const communityIds = asFilterList(communityId);
  const paymentMethods = asFilterList(paymentMethod);

  if (statuses.length === 1) query = query.eq('status', statuses[0]);
  else if (statuses.length > 1) query = query.in('status', statuses);

  if (communityIds.length === 1) query = query.eq('community_id', communityIds[0]);
  else if (communityIds.length > 1) {
    query = query.in('community_id', communityIds);
  }

  if (paymentMethods.length === 1) {
    query = query.eq('payment_method', paymentMethods[0]);
  } else if (paymentMethods.length > 1) {
    query = query.in('payment_method', paymentMethods);
  }

  if (search) query = query.ilike('order_number', `%${search}%`);
  if (pickupSlotIds) query = query.in('pickup_slot_id', pickupSlotIds);
  if (deliverySlotIds) query = query.in('delivery_slot_id', deliverySlotIds);
  if (customers.ids) query = query.in('customer_id', customers.ids);
  if (addresses.ids) query = query.in('address_id', addresses.ids);
  if (orderIdsFilter) query = query.in('id', orderIdsFilter);

  const feedbackQ = cols.feedback?.trim();
  if (feedbackQ) {
    query = query.ilike('customer_feedback', `%${feedbackQ}%`);
  }
  const instructionsQ = cols.instructions?.trim();
  if (instructionsQ) {
    query = query.ilike('special_instructions', `%${instructionsQ}%`);
  }

  const amountQ = cols.amount?.trim();
  if (amountQ) {
    const n = Number(amountQ.replace(/,/g, ''));
    if (!Number.isNaN(n)) query = query.eq('total_amount', n);
  }

  const ratingQ = cols.rating?.trim();
  if (ratingQ) {
    const n = Number(ratingQ);
    if (!Number.isNaN(n)) query = query.eq('customer_rating', n);
  }

  if (cols.bookedDate?.trim()) {
    const day = parseLocalDay(cols.bookedDate);
    if (day) {
      query = query
        .gte('created_at', day.start.toISOString())
        .lte('created_at', day.end.toISOString());
    }
  }

  const { data, count, error } = await query
    .order(sortKey, { ascending: sortAsc })
    .range(from, to);

  if (error) {
    console.error('[fetchOrders]', error.message);
  }

  return { data: data ?? [], total: count ?? 0, error };
};

export const fetchOrderById = async (orderId: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      profiles!orders_customer_id_fkey(id, full_name, phone, email),
      communities(id, name, city),
      addresses(flat_number, tower),
      order_items(*, services(name, unit)),
      order_events(*, profiles(full_name)),
      rider_jobs(*, riders(id, profiles!riders_id_fkey(full_name)))
    `)
    .eq('id', orderId)
    .single();

  return { data, error };
};

export const fetchOrderEvents = async (orderId: string) => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('order_events')
    .select('*, profiles(full_name)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  return data ?? [];
};
