import type { OrderStatus, PaymentMethod } from '@ironcloud/db';
import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

export type OrderListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrderStatus;
  communityId?: string;
  paymentMethod?: PaymentMethod;
  /**
   * Filter by pickup slot window (not booking created_at).
   * Prefer dateFrom/dateTo for ranges; `date` is a single-day shorthand.
   */
  date?: Date;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  sortKey?: string;
  sortAsc?: boolean;
};

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
    sortKey = 'created_at',
    sortAsc = false,
  } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const rangeStart = dateFrom ?? (date ? startOfDay(date) : null);
  const rangeEnd = dateTo ?? (date ? endOfDay(date) : null);

  // Nested embed filters do not constrain parent rows (left join). Resolve slot ids first.
  let pickupSlotIds: string[] | null = null;
  if (rangeStart || rangeEnd) {
    let slotsQuery = supabase.from('service_slots').select('id');
    if (rangeStart) {
      slotsQuery = slotsQuery.gte('window_start', rangeStart.toISOString());
    }
    if (rangeEnd) {
      slotsQuery = slotsQuery.lte('window_start', rangeEnd.toISOString());
    }
    const { data: slots, error: slotsError } = await slotsQuery;
    if (slotsError) {
      console.error('[fetchOrders] service_slots', slotsError.message);
      return { data: [], total: 0, error: slotsError };
    }
    pickupSlotIds = (slots ?? []).map((s) => s.id);
    if (pickupSlotIds.length === 0) {
      return { data: [], total: 0, error: null };
    }
  }

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, status, total_amount, created_at, payment_method, pickup_slot_id, delivery_slot_id, community_id,
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

  if (status) query = query.eq('status', status);
  if (communityId) query = query.eq('community_id', communityId);
  if (paymentMethod) query = query.eq('payment_method', paymentMethod);
  if (search) query = query.ilike('order_number', `%${search}%`);
  if (pickupSlotIds) query = query.in('pickup_slot_id', pickupSlotIds);

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
