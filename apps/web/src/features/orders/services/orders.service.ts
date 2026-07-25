import type { OrderStatus } from '@ironcloud/db';
import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

export type OrderListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: OrderStatus;
  /** Filter by pickup slot day (not booking created_at). */
  date?: Date;
  sortKey?: string;
  sortAsc?: boolean;
};

export const fetchOrders = async (params: OrderListParams) => {
  const supabase = getSupabase();
  const { page, pageSize, search, status, date, sortKey = 'created_at', sortAsc = false } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let pickupSlotIds: string[] | null = null;
  if (date) {
    const dayStart = startOfDay(date).toISOString();
    const dayEnd = endOfDay(date).toISOString();
    const { data: slots, error: slotsError } = await supabase
      .from('service_slots')
      .select('id')
      .gte('window_start', dayStart)
      .lte('window_start', dayEnd);

    if (slotsError) return { data: [], total: 0, error: slotsError };
    pickupSlotIds = (slots ?? []).map((s) => s.id);
    if (pickupSlotIds.length === 0) {
      return { data: [], total: 0, error: null };
    }
  }

  let query = supabase
    .from('orders')
    .select(`
      id, order_number, status, total_amount, created_at, payment_method, pickup_slot_id,
      profiles!orders_customer_id_fkey(full_name, phone),
      communities(name),
      addresses(flat_number, tower),
      pickup_slot:service_slots!pickup_slot_id(window_start, window_end)
    `, { count: 'exact' });

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('order_number', `%${search}%`);
  if (pickupSlotIds) query = query.in('pickup_slot_id', pickupSlotIds);

  const { data, count, error } = await query
    .order(sortKey, { ascending: sortAsc })
    .range(from, to);

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
