import { castRows } from '@/lib/query';
import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay, toISODate } from '@/utils/format';
import {
  previousDateRange,
  type DateRange,
} from '@/features/orders/utils/datePresets';

export type DashboardKPIs = {
  totalOrders: number;
  pendingPickups: number;
  inProgress: number;
  outForDelivery: number;
  delivered: number;
  revenueToday: number;
  walletBalance: number;
  activeCustomers: number;
  activePartners: number;
  activeRiders: number;
  trends: Record<string, { value: number; previous: number }>;
};

const PENDING_PICKUP_STATUSES = ['booked', 'pickup_assigned', 'pickup_in_progress'];
const IN_PROGRESS_STATUSES = [
  'picked_up',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
];
const OUT_FOR_DELIVERY_STATUSES = ['delivery_assigned', 'out_for_delivery'];
const DELIVERED_STATUSES = ['delivered', 'completed', 'rated'];

/** Rankings use a recent window — all-time full-table scans are wrong past PostgREST row caps. */
const RANKING_LOOKBACK_DAYS = 30;

type ActiveOrderRow = {
  id: string;
  status: string;
  total_amount: number;
  customer_id: string;
  pickup_slot_id: string | null;
  delivery_slot_id: string | null;
};

type SlotRow = { id: string; window_start: string };

/**
 * Orders with a pickup or delivery slot whose window falls in the range
 * (operational "active that day"), not orders booked via created_at.
 */
async function fetchActiveOrdersInRange(
  range: DateRange,
  select: string,
  communityId?: string,
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase();
  const rangeStart = range.from;
  const rangeEnd = range.to;
  if (!rangeStart && !rangeEnd) return [];

  let slotsQuery = supabase.from('service_slots').select('id, window_start');
  if (rangeStart) slotsQuery = slotsQuery.gte('window_start', rangeStart.toISOString());
  if (rangeEnd) slotsQuery = slotsQuery.lte('window_start', rangeEnd.toISOString());

  const { data: slots, error: slotsError } = await slotsQuery;
  if (slotsError) {
    console.error('[dashboard] service_slots', slotsError.message);
    return [];
  }

  const slotRows = castRows<SlotRow>(slots);
  if (slotRows.length === 0) return [];

  const slotIds = slotRows.map((s) => s.id);
  // PostgREST .or() with .in() lists; chunk if a huge custom range ever blows URL limits.
  const orFilter = `pickup_slot_id.in.(${slotIds.join(',')}),delivery_slot_id.in.(${slotIds.join(',')})`;

  let query = supabase.from('orders').select(select).or(orFilter);
  if (communityId) query = query.eq('community_id', communityId);

  const { data, error } = await query;
  if (error) {
    console.error('[dashboard] active orders', error.message);
    return [];
  }

  // Dedupe — an order can match both pickup and delivery filters in theory via .or().
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of castRows<Record<string, unknown> & { id: string }>(data)) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

async function fetchActiveOrderCount(range: DateRange, communityId?: string): Promise<number> {
  const rows = await fetchActiveOrdersInRange(range, 'id', communityId);
  return rows.length;
}

export const fetchDashboardKPIs = async (
  range: DateRange,
  communityId?: string,
): Promise<DashboardKPIs> => {
  const supabase = getSupabase();
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  const prevRange = previousDateRange(effectiveRange);

  const [orderRows, totalYesterday, wallets, partners, riders] = await Promise.all([
    fetchActiveOrdersInRange(
      effectiveRange,
      'id, status, total_amount, customer_id, pickup_slot_id, delivery_slot_id',
      communityId,
    ),
    fetchActiveOrderCount(prevRange, communityId),
    supabase.from('wallets').select('balance'),
    supabase.from('partners').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('riders').select('id', { count: 'exact', head: true }),
  ]);

  const orders = orderRows as unknown as ActiveOrderRow[];
  const uniqueCustomers = new Set(orders.map((o) => o.customer_id));

  const countByStatus = (statuses: string[]) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const revenueToday = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const walletBalance = castRows<{ balance: number }>(wallets.data).reduce(
    (s, w) => s + Number(w.balance ?? 0),
    0,
  );

  const totalToday = orders.length;

  return {
    totalOrders: totalToday,
    pendingPickups: countByStatus(PENDING_PICKUP_STATUSES),
    inProgress: countByStatus(IN_PROGRESS_STATUSES),
    outForDelivery: countByStatus(OUT_FOR_DELIVERY_STATUSES),
    delivered: countByStatus(DELIVERED_STATUSES),
    revenueToday,
    walletBalance,
    activeCustomers: uniqueCustomers.size,
    activePartners: partners.count ?? 0,
    activeRiders: riders.count ?? 0,
    trends: {
      totalOrders: { value: totalToday, previous: totalYesterday },
    },
  };
};

export const fetchOrdersOverview = async (range: DateRange, communityId?: string) => {
  const supabase = getSupabase();
  const rangeStart = range.from ?? startOfDay(new Date());
  const rangeEnd = range.to ?? endOfDay(new Date());

  let slotsQuery = supabase
    .from('service_slots')
    .select('id, window_start')
    .gte('window_start', rangeStart.toISOString())
    .lte('window_start', rangeEnd.toISOString());

  const { data: slots, error: slotsError } = await slotsQuery;
  if (slotsError) {
    console.error('[dashboard] overview slots', slotsError.message);
    return [];
  }

  const slotRows = castRows<SlotRow>(slots);
  if (slotRows.length === 0) return [];

  const slotDayById = new Map<string, string>();
  for (const slot of slotRows) {
    slotDayById.set(slot.id, toISODate(new Date(slot.window_start)));
  }

  const slotIds = slotRows.map((s) => s.id);
  const orFilter = `pickup_slot_id.in.(${slotIds.join(',')}),delivery_slot_id.in.(${slotIds.join(',')})`;

  let query = supabase
    .from('orders')
    .select('id, pickup_slot_id, delivery_slot_id')
    .or(orFilter);
  if (communityId) query = query.eq('community_id', communityId);

  const { data, error } = await query;
  if (error) {
    console.error('[dashboard] overview orders', error.message);
    return [];
  }

  const counts: Record<string, Set<string>> = {};
  for (const order of castRows<{
    id: string;
    pickup_slot_id: string | null;
    delivery_slot_id: string | null;
  }>(data)) {
    const days = new Set<string>();
    if (order.pickup_slot_id && slotDayById.has(order.pickup_slot_id)) {
      days.add(slotDayById.get(order.pickup_slot_id)!);
    }
    if (order.delivery_slot_id && slotDayById.has(order.delivery_slot_id)) {
      days.add(slotDayById.get(order.delivery_slot_id)!);
    }
    for (const day of days) {
      if (!counts[day]) counts[day] = new Set();
      counts[day].add(order.id);
    }
  }

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, ids]) => ({ date, count: ids.size }));
};

export const fetchOrderStatusDistribution = async (
  range: DateRange,
  communityId?: string,
) => {
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  const orders = await fetchActiveOrdersInRange(
    effectiveRange,
    'id, status',
    communityId,
  );

  const counts: Record<string, number> = {};
  for (const o of orders as unknown as { status: string }[]) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  return Object.entries(counts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));
};

export const fetchTopCommunities = async (limit = 5) => {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - RANKING_LOOKBACK_DAYS);
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('orders')
    .select('community_id, communities(name)')
    .not('community_id', 'is', null)
    .gte('created_at', since.toISOString());

  const counts: Record<string, { id: string; name: string; count: number }> = {};
  (data ?? []).forEach((o) => {
    const id = o.community_id;
    const name = (o.communities as { name: string } | null)?.name ?? 'Unknown';
    if (!counts[id]) counts[id] = { id, name, count: 0 };
    counts[id].count++;
  });

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const fetchRecentOrders = async (limit = 8, communityId?: string) => {
  const supabase = getSupabase();
  let query = supabase
    .from('orders')
    .select(`
      id, order_number, status, created_at, total_amount,
      profiles!orders_customer_id_fkey(full_name),
      addresses(flat_number, tower),
      communities(name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (communityId) query = query.eq('community_id', communityId);

  const { data } = await query;

  return data ?? [];
};

export const fetchTopPartners = async (limit = 5) => {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - RANKING_LOOKBACK_DAYS);
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('partner_orders')
    .select('partner_id, assigned_at, partners(name, rating_avg)')
    .gte('assigned_at', since.toISOString());

  const counts: Record<
    string,
    { id: string; name: string; count: number; rating: number }
  > = {};
  (data ?? []).forEach((po) => {
    const id = po.partner_id;
    const partner = po.partners as { name: string; rating_avg: number } | null;
    if (!counts[id]) {
      counts[id] = {
        id,
        name: partner?.name ?? 'Unknown',
        count: 0,
        rating: partner?.rating_avg ?? 0,
      };
    }
    counts[id].count++;
  });

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const fetchLowWalletUsers = async (threshold = 100, limit = 5) => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('wallets')
    .select('balance, profiles!wallets_customer_id_fkey(full_name, phone)')
    .lt('balance', threshold)
    .order('balance', { ascending: true })
    .limit(limit);

  return data ?? [];
};

export type DashboardKpiKey =
  | 'totalOrders'
  | 'pendingPickups'
  | 'inProgress'
  | 'outForDelivery'
  | 'delivered'
  | 'revenue'
  | 'walletBalance'
  | 'activeCustomers'
  | 'activePartners'
  | 'activeRiders';

export const DASHBOARD_KPI_TITLES: Record<DashboardKpiKey, string> = {
  totalOrders: 'Total Orders',
  pendingPickups: 'Pending Pickups',
  inProgress: 'In Progress',
  outForDelivery: 'Out for Delivery',
  delivered: 'Delivered',
  revenue: 'Revenue',
  walletBalance: 'Wallet Balance',
  activeCustomers: 'Active Customers',
  activePartners: 'Active Partners',
  activeRiders: 'Active Riders',
};

const ORDER_KPI_STATUSES: Partial<Record<DashboardKpiKey, string[]>> = {
  pendingPickups: PENDING_PICKUP_STATUSES,
  inProgress: IN_PROGRESS_STATUSES,
  outForDelivery: OUT_FOR_DELIVERY_STATUSES,
  delivered: DELIVERED_STATUSES,
};

export type DashboardOrderDetail = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  profiles: { full_name: string } | null;
  communities: { name: string } | null;
};

export type DashboardWalletDetail = {
  id: string;
  balance: number;
  profiles: { full_name: string; phone: string } | null;
};

export type DashboardCustomerDetail = {
  id: string;
  full_name: string;
  phone: string | null;
  order_count: number;
};

export type DashboardPartnerDetail = {
  id: string;
  name: string;
  rating_avg: number | null;
  is_active: boolean;
};

export type DashboardRiderDetail = {
  id: string;
  vehicle_number: string | null;
  kyc_status: string;
  is_active: boolean;
  rating_avg: number;
  profiles: { full_name: string; phone: string | null } | null;
};

export type DashboardKpiDetails =
  | { kind: 'orders'; rows: DashboardOrderDetail[] }
  | { kind: 'wallets'; rows: DashboardWalletDetail[] }
  | { kind: 'customers'; rows: DashboardCustomerDetail[] }
  | { kind: 'partners'; rows: DashboardPartnerDetail[] }
  | { kind: 'riders'; rows: DashboardRiderDetail[] };

const ORDER_DETAIL_SELECT = `
  id, order_number, status, total_amount, created_at,
  profiles!orders_customer_id_fkey(full_name),
  communities(name)
`;

export const fetchDashboardKpiDetails = async (
  kpi: DashboardKpiKey,
  range: DateRange,
  communityId?: string,
): Promise<DashboardKpiDetails> => {
  const supabase = getSupabase();
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  if (
    kpi === 'totalOrders' ||
    kpi === 'revenue' ||
    kpi === 'pendingPickups' ||
    kpi === 'inProgress' ||
    kpi === 'outForDelivery' ||
    kpi === 'delivered'
  ) {
    const rows = (await fetchActiveOrdersInRange(
      effectiveRange,
      ORDER_DETAIL_SELECT,
      communityId,
    )) as unknown as DashboardOrderDetail[];

    const statuses = ORDER_KPI_STATUSES[kpi];
    const filtered = statuses
      ? rows.filter((o) => statuses.includes(o.status))
      : rows;

    filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      kind: 'orders',
      rows: filtered.slice(0, 100),
    };
  }

  if (kpi === 'walletBalance') {
    const { data, error } = await supabase
      .from('wallets')
      .select('id, balance, profiles!wallets_customer_id_fkey(full_name, phone)')
      .order('balance', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[fetchDashboardKpiDetails] wallets', error.message);
      return { kind: 'wallets', rows: [] };
    }

    return {
      kind: 'wallets',
      rows: castRows<DashboardWalletDetail>(data),
    };
  }

  if (kpi === 'activeCustomers') {
    const rows = await fetchActiveOrdersInRange(
      effectiveRange,
      'customer_id, profiles!orders_customer_id_fkey(full_name, phone)',
      communityId,
    );

    const byCustomer: Record<string, DashboardCustomerDetail> = {};
    for (const row of rows as unknown as {
      customer_id: string;
      profiles: { full_name: string; phone: string | null } | null;
    }[]) {
      const existing = byCustomer[row.customer_id];
      if (existing) {
        existing.order_count += 1;
        continue;
      }
      byCustomer[row.customer_id] = {
        id: row.customer_id,
        full_name: row.profiles?.full_name ?? 'Unknown',
        phone: row.profiles?.phone ?? null,
        order_count: 1,
      };
    }

    return {
      kind: 'customers',
      rows: Object.values(byCustomer).sort((a, b) => b.order_count - a.order_count),
    };
  }

  if (kpi === 'activePartners') {
    const { data, error } = await supabase
      .from('partners')
      .select('id, name, rating_avg, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[fetchDashboardKpiDetails] partners', error.message);
      return { kind: 'partners', rows: [] };
    }

    return {
      kind: 'partners',
      rows: castRows<DashboardPartnerDetail>(data),
    };
  }

  const { data, error } = await supabase
    .from('riders')
    .select(
      'id, vehicle_number, kyc_status, is_active, rating_avg, profiles!riders_id_fkey(full_name, phone)',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[fetchDashboardKpiDetails] riders', error.message);
    return { kind: 'riders', rows: [] };
  }

  return {
    kind: 'riders',
    rows: castRows<DashboardRiderDetail>(data),
  };
};

/** Single payload for dashboard — one React Query key / cache entry. */
export const fetchDashboardBundle = async (
  range: DateRange,
  communityId?: string,
) => {
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  const [kpis, overview, statusDist, topCommunities, topPartners, recentOrders, lowWallet] =
    await Promise.all([
      fetchDashboardKPIs(effectiveRange, communityId),
      fetchOrdersOverview(effectiveRange, communityId),
      fetchOrderStatusDistribution(effectiveRange, communityId),
      fetchTopCommunities(),
      fetchTopPartners(),
      fetchRecentOrders(8, communityId),
      fetchLowWalletUsers(),
    ]);

  return {
    kpis,
    overview,
    statusDist,
    topCommunities,
    topPartners,
    recentOrders,
    lowWallet,
  };
};
