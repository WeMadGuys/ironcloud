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

const ADDRESS_PAGE = 1000;
const CUSTOMER_ID_CHUNK = 150;

const PENDING_PICKUP_STATUSES = ['booked', 'pickup_assigned', 'pickup_in_progress'];
const IN_PROGRESS_STATUSES = [
  'picked_up',
  'picked_up_no_delivery',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
];
const OUT_FOR_DELIVERY_STATUSES = ['delivery_assigned', 'out_for_delivery'];
const DELIVERED_STATUSES = ['delivered', 'completed', 'rated'];

const TXN_PAGE = 1000;

function includeOrder(status: string, ignoreCancelled: boolean): boolean {
  return !ignoreCancelled || status !== 'cancelled';
}

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
  /** `pickup` / `delivery` limit to that slot. `any` matches either slot that day. */
  match: 'any' | 'pickup' | 'delivery' = 'any',
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase();
  const rangeStart = range.from;
  const rangeEnd = range.to;
  if (!rangeStart && !rangeEnd) return [];

  let slotsQuery = supabase.from('service_slots').select('id, window_start');
  if (match === 'pickup') slotsQuery = slotsQuery.eq('slot_type', 'pickup');
  if (match === 'delivery') slotsQuery = slotsQuery.eq('slot_type', 'delivery');
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

  let query = supabase.from('orders').select(select);
  query =
    match === 'pickup'
      ? query.in('pickup_slot_id', slotIds)
      : match === 'delivery'
        ? query.in('delivery_slot_id', slotIds)
        : query.or(orFilter);
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

async function fetchActiveOrderCount(
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
): Promise<number> {
  const rows = await fetchActiveOrdersInRange(range, 'id, status', communityId);
  return rows.filter((row) => includeOrder(String(row.status ?? ''), ignoreCancelled)).length;
}

/** Customers belong to a community through their addresses, not through wallets. */
async function customerIdsInCommunity(communityId: string): Promise<string[]> {
  const supabase = getSupabase();
  const ids = new Set<string>();

  for (let from = 0; ; from += ADDRESS_PAGE) {
    const { data, error } = await supabase
      .from('addresses')
      .select('customer_id')
      .eq('community_id', communityId)
      .order('id', { ascending: true })
      .range(from, from + ADDRESS_PAGE - 1);

    if (error) {
      console.error('[dashboard] community customers', error.message);
      return [];
    }

    const page = castRows<{ customer_id: string }>(data);
    for (const row of page) {
      if (row.customer_id) ids.add(row.customer_id);
    }
    if (page.length < ADDRESS_PAGE) break;
  }

  return [...ids];
}

async function sumWalletBalance(communityId?: string): Promise<number> {
  const supabase = getSupabase();

  if (!communityId) {
    const { data } = await supabase.from('wallets').select('balance');
    return castRows<{ balance: number }>(data).reduce(
      (s, w) => s + Number(w.balance ?? 0),
      0,
    );
  }

  const customerIds = await customerIdsInCommunity(communityId);
  if (customerIds.length === 0) return 0;

  let total = 0;
  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .in('customer_id', chunk);

    if (error) {
      console.error('[dashboard] wallets', error.message);
      continue;
    }

    total += castRows<{ balance: number }>(data).reduce(
      (s, w) => s + Number(w.balance ?? 0),
      0,
    );
  }

  return total;
}

function firstEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type DebitOrderEmbed = {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
  communities: { name: string } | { name: string }[] | null;
};

type OrderDebitRow = {
  id: string;
  amount: number;
  order_id: string;
  orders: DebitOrderEmbed | DebitOrderEmbed[] | null;
};

const ORDER_DEBIT_SELECT = `
  id, amount, order_id,
  orders!inner(
    id, order_number, status, total_amount, created_at, community_id,
    profiles!orders_customer_id_fkey(full_name),
    communities(name)
  )
`;

/** Wallet debits tied to an order and posted on the selected day. Order status is ignored. */
async function fetchOrderDebits(
  range: DateRange,
  communityId?: string,
): Promise<OrderDebitRow[]> {
  const supabase = getSupabase();
  const rangeStart = range.from;
  const rangeEnd = range.to;
  if (!rangeStart || !rangeEnd) return [];

  const rows: OrderDebitRow[] = [];
  for (let from = 0; ; from += TXN_PAGE) {
    let query = supabase
      .from('wallet_transactions')
      .select(ORDER_DEBIT_SELECT)
      .eq('type', 'debit')
      .not('order_id', 'is', null)
      .gte('created_at', rangeStart.toISOString())
      .lte('created_at', rangeEnd.toISOString())
      .order('id', { ascending: true })
      .range(from, from + TXN_PAGE - 1);

    if (communityId) query = query.eq('orders.community_id', communityId);

    const { data, error } = await query;
    if (error) {
      console.error('[dashboard] wallet debits', error.message);
      return rows;
    }

    const page = castRows<OrderDebitRow>(data);
    rows.push(...page);
    if (page.length < TXN_PAGE) break;
  }

  return rows;
}

function debitAmount(row: OrderDebitRow): number {
  return Math.abs(Number(row.amount ?? 0));
}

async function orderIdsInRange(
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
): Promise<string[]> {
  const rows = await fetchActiveOrdersInRange(range, 'id, status', communityId);
  return rows
    .filter((row) => includeOrder(String(row.status ?? ''), ignoreCancelled))
    .map((row) => String(row.id));
}

async function partnerIdsForOrders(orderIds: string[]): Promise<string[]> {
  if (orderIds.length === 0) return [];
  const supabase = getSupabase();
  const ids = new Set<string>();

  for (let i = 0; i < orderIds.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = orderIds.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('partner_orders')
      .select('partner_id')
      .in('order_id', chunk);

    if (error) {
      console.error('[dashboard] partner orders', error.message);
      continue;
    }

    for (const row of castRows<{ partner_id: string }>(data)) {
      if (row.partner_id) ids.add(row.partner_id);
    }
  }

  return [...ids];
}

/** Riders with a pickup or delivery job scheduled in the range. */
async function riderIdsInRange(
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
): Promise<string[]> {
  const supabase = getSupabase();
  const rangeStart = range.from;
  const rangeEnd = range.to;
  if (!rangeStart || !rangeEnd) return [];

  const ids = new Set<string>();
  for (let from = 0; ; from += TXN_PAGE) {
    let query = supabase
      .from('rider_jobs')
      .select('id, rider_id, orders!inner(community_id, status)')
      .not('rider_id', 'is', null)
      .gte('scheduled_start', rangeStart.toISOString())
      .lte('scheduled_start', rangeEnd.toISOString())
      .order('id', { ascending: true })
      .range(from, from + TXN_PAGE - 1);

    if (communityId) query = query.eq('orders.community_id', communityId);

    const { data, error } = await query;
    if (error) {
      console.error('[dashboard] rider jobs', error.message);
      return [...ids];
    }

    const page = castRows<{
      rider_id: string | null;
      orders: { status?: string } | { status?: string }[] | null;
    }>(data);
    for (const row of page) {
      const order = firstEmbed(row.orders);
      if (!includeOrder(order?.status ?? '', ignoreCancelled)) continue;
      if (row.rider_id) ids.add(row.rider_id);
    }
    if (page.length < TXN_PAGE) break;
  }

  return [...ids];
}

export const fetchDashboardKPIs = async (
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
): Promise<DashboardKPIs> => {
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  const prevRange = previousDateRange(effectiveRange);

  const [orderRows, debitRows, totalYesterday, walletBalance, riderIds] = await Promise.all([
    fetchActiveOrdersInRange(
      effectiveRange,
      'id, status, total_amount, customer_id, pickup_slot_id, delivery_slot_id',
      communityId,
    ),
    fetchOrderDebits(effectiveRange, communityId),
    fetchActiveOrderCount(prevRange, communityId, ignoreCancelled),
    sumWalletBalance(communityId),
    riderIdsInRange(effectiveRange, communityId, ignoreCancelled),
  ]);

  const orders = (orderRows as unknown as ActiveOrderRow[]).filter((order) =>
    includeOrder(order.status, ignoreCancelled),
  );
  const uniqueCustomers = new Set(orders.map((o) => o.customer_id));

  const countByStatus = (statuses: string[]) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const revenueToday = debitRows.reduce((sum, row) => sum + debitAmount(row), 0);
  const partnerIds = await partnerIdsForOrders(orders.map((order) => order.id));

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
    activePartners: partnerIds.length,
    activeRiders: riderIds.length,
    trends: {
      totalOrders: { value: totalToday, previous: totalYesterday },
    },
  };
};

export const fetchOrdersOverview = async (
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
) => {
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
    .select('id, status, pickup_slot_id, delivery_slot_id')
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
    status: string;
    pickup_slot_id: string | null;
    delivery_slot_id: string | null;
  }>(data)) {
    if (!includeOrder(order.status, ignoreCancelled)) continue;
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
  ignoreCancelled = false,
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
    if (!includeOrder(o.status, ignoreCancelled)) continue;
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  return Object.entries(counts).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
  }));
};

export const fetchTopCommunities = async (
  range: DateRange,
  limit = 5,
  communityId?: string,
  ignoreCancelled = false,
) => {
  const orders = await fetchActiveOrdersInRange(
    range,
    'id, status, community_id, communities(name)',
    communityId,
  );

  const counts: Record<string, { id: string; name: string; count: number }> = {};
  for (const order of orders as unknown as {
    status: string;
    community_id: string | null;
    communities: { name: string } | { name: string }[] | null;
  }[]) {
    if (!includeOrder(order.status, ignoreCancelled)) continue;
    const id = order.community_id;
    if (!id) continue;
    const community = firstEmbed(order.communities);
    if (!counts[id]) counts[id] = { id, name: community?.name ?? 'Unknown', count: 0 };
    counts[id].count += 1;
  }

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

const RECENT_ORDER_SELECT = `
  id, order_number, status, created_at, total_amount,
  profiles!orders_customer_id_fkey(full_name),
  addresses(flat_number, tower),
  communities(name)
`;

type RecentOrderRow = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  total_amount: number;
  profiles: { full_name: string } | null;
  addresses: { flat_number: string; tower: string } | null;
  communities: { name: string } | null;
};

export const fetchRecentOrders = async (
  limit = 8,
  communityId?: string,
  range?: DateRange,
  ignoreCancelled = false,
) => {
  const effectiveRange: DateRange = range?.from || range?.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  const rows = (await fetchActiveOrdersInRange(
    effectiveRange,
    RECENT_ORDER_SELECT,
    communityId,
  )) as unknown as RecentOrderRow[];

  return rows
    .filter((row) => includeOrder(row.status, ignoreCancelled))
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
};

type PartnerAssignment = {
  partner_id: string;
  partners: { name: string; rating_avg: number } | { name: string; rating_avg: number }[] | null;
};

export const fetchTopPartners = async (
  range: DateRange,
  limit = 5,
  communityId?: string,
  ignoreCancelled = false,
) => {
  const orderIds = await orderIdsInRange(range, communityId, ignoreCancelled);
  if (orderIds.length === 0) return [];

  const supabase = getSupabase();
  const counts: Record<string, { id: string; name: string; count: number; rating: number }> = {};

  for (let i = 0; i < orderIds.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = orderIds.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('partner_orders')
      .select('partner_id, partners(name, rating_avg)')
      .in('order_id', chunk);

    if (error) {
      console.error('[dashboard] top partners', error.message);
      continue;
    }

    for (const row of castRows<PartnerAssignment>(data)) {
      const partner = firstEmbed(row.partners);
      if (!counts[row.partner_id]) {
        counts[row.partner_id] = {
          id: row.partner_id,
          name: partner?.name ?? 'Unknown',
          count: 0,
          rating: Number(partner?.rating_avg ?? 0),
        };
      }
      counts[row.partner_id].count += 1;
    }
  }

  return Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

export const fetchLowWalletUsers = async (
  threshold = 100,
  limit = 5,
  communityId?: string,
) => {
  const supabase = getSupabase();
  const select = 'balance, profiles!wallets_customer_id_fkey(full_name, phone)';

  if (!communityId) {
    const { data } = await supabase
      .from('wallets')
      .select(select)
      .lt('balance', threshold)
      .order('balance', { ascending: true })
      .limit(limit);

    return data ?? [];
  }

  const customerIds = await customerIdsInCommunity(communityId);
  if (customerIds.length === 0) return [];

  type LowWalletRow = {
    balance: number;
    profiles: { full_name: string; phone: string } | null;
  };

  const rows: LowWalletRow[] = [];
  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('wallets')
      .select(select)
      .in('customer_id', chunk)
      .lt('balance', threshold);

    if (error) {
      console.error('[dashboard] low wallets', error.message);
      continue;
    }

    rows.push(...castRows<LowWalletRow>(data));
  }

  return rows
    .sort((a, b) => Number(a.balance) - Number(b.balance))
    .slice(0, limit);
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
  /** Sum of wallet debits for this order inside the selected range. */
  debited_amount?: number;
};

export type DashboardWalletDetail = {
  id: string;
  balance: number;
  profiles: { full_name: string; phone: string } | null;
};

const WALLET_DETAIL_SELECT =
  'id, balance, profiles!wallets_customer_id_fkey(full_name, phone)';

async function fetchWalletDetails(communityId?: string): Promise<DashboardWalletDetail[]> {
  const supabase = getSupabase();

  if (!communityId) {
    const { data, error } = await supabase
      .from('wallets')
      .select(WALLET_DETAIL_SELECT)
      .order('balance', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[fetchDashboardKpiDetails] wallets', error.message);
      return [];
    }

    return castRows<DashboardWalletDetail>(data);
  }

  const customerIds = await customerIdsInCommunity(communityId);
  if (customerIds.length === 0) return [];

  const rows: DashboardWalletDetail[] = [];
  for (let i = 0; i < customerIds.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = customerIds.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('wallets')
      .select(WALLET_DETAIL_SELECT)
      .in('customer_id', chunk);

    if (error) {
      console.error('[fetchDashboardKpiDetails] wallets', error.message);
      continue;
    }

    rows.push(...castRows<DashboardWalletDetail>(data));
  }

  rows.sort((a, b) => Number(b.balance) - Number(a.balance));
  return rows.slice(0, 100);
}

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

function ordersFromDebits(rows: OrderDebitRow[]): DashboardOrderDetail[] {
  const byOrder = new Map<string, DashboardOrderDetail>();
  for (const row of rows) {
    const order = firstEmbed(row.orders);
    if (!order) continue;
    const amount = debitAmount(row);
    const existing = byOrder.get(order.id);
    if (existing) {
      existing.debited_amount = (existing.debited_amount ?? 0) + amount;
      continue;
    }
    byOrder.set(order.id, {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: Number(order.total_amount ?? 0),
      created_at: order.created_at,
      profiles: firstEmbed(order.profiles),
      communities: firstEmbed(order.communities),
      debited_amount: amount,
    });
  }

  return [...byOrder.values()].sort(
    (a, b) => (b.debited_amount ?? 0) - (a.debited_amount ?? 0),
  );
}

async function fetchPartnersByIds(ids: string[]): Promise<DashboardPartnerDetail[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabase();
  const rows: DashboardPartnerDetail[] = [];

  for (let i = 0; i < ids.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = ids.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('partners')
      .select('id, name, rating_avg, is_active')
      .in('id', chunk);

    if (error) {
      console.error('[fetchDashboardKpiDetails] partners', error.message);
      continue;
    }

    rows.push(...castRows<DashboardPartnerDetail>(data));
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows.slice(0, 100);
}

const RIDER_DETAIL_SELECT =
  'id, vehicle_number, kyc_status, is_active, rating_avg, profiles!riders_id_fkey(full_name, phone)';

async function fetchRidersByIds(ids: string[]): Promise<DashboardRiderDetail[]> {
  if (ids.length === 0) return [];
  const supabase = getSupabase();
  const rows: DashboardRiderDetail[] = [];

  for (let i = 0; i < ids.length; i += CUSTOMER_ID_CHUNK) {
    const chunk = ids.slice(i, i + CUSTOMER_ID_CHUNK);
    const { data, error } = await supabase
      .from('riders')
      .select(RIDER_DETAIL_SELECT)
      .in('id', chunk);

    if (error) {
      console.error('[fetchDashboardKpiDetails] riders', error.message);
      continue;
    }

    rows.push(...castRows<DashboardRiderDetail>(data));
  }

  rows.sort((a, b) =>
    (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? ''),
  );
  return rows.slice(0, 100);
}

export const fetchDashboardKpiDetails = async (
  kpi: DashboardKpiKey,
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
): Promise<DashboardKpiDetails> => {
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  if (kpi === 'revenue') {
    const debits = await fetchOrderDebits(effectiveRange, communityId);
    return { kind: 'orders', rows: ordersFromDebits(debits).slice(0, 100) };
  }

  if (
    kpi === 'totalOrders' ||
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
    const filtered = rows.filter((o) => {
      if (!includeOrder(o.status, ignoreCancelled)) return false;
      return !statuses || statuses.includes(o.status);
    });

    filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return {
      kind: 'orders',
      rows: filtered.slice(0, 100),
    };
  }

  if (kpi === 'walletBalance') {
    return {
      kind: 'wallets',
      rows: await fetchWalletDetails(communityId),
    };
  }

  if (kpi === 'activeCustomers') {
    const rows = await fetchActiveOrdersInRange(
      effectiveRange,
      'id, status, customer_id, profiles!orders_customer_id_fkey(full_name, phone)',
      communityId,
    );

    const byCustomer: Record<string, DashboardCustomerDetail> = {};
    for (const row of rows as unknown as {
      status: string;
      customer_id: string;
      profiles:
        | { full_name: string; phone: string | null }
        | { full_name: string; phone: string | null }[]
        | null;
    }[]) {
      if (!includeOrder(row.status, ignoreCancelled)) continue;
      const profile = firstEmbed(row.profiles);
      const existing = byCustomer[row.customer_id];
      if (existing) {
        existing.order_count += 1;
        continue;
      }
      byCustomer[row.customer_id] = {
        id: row.customer_id,
        full_name: profile?.full_name ?? 'Unknown',
        phone: profile?.phone ?? null,
        order_count: 1,
      };
    }

    return {
      kind: 'customers',
      rows: Object.values(byCustomer).sort((a, b) => b.order_count - a.order_count),
    };
  }

  if (kpi === 'activePartners') {
    const orderIds = await orderIdsInRange(effectiveRange, communityId, ignoreCancelled);
    const partnerIds = await partnerIdsForOrders(orderIds);
    return { kind: 'partners', rows: await fetchPartnersByIds(partnerIds) };
  }

  const riderIds = await riderIdsInRange(effectiveRange, communityId, ignoreCancelled);
  return { kind: 'riders', rows: await fetchRidersByIds(riderIds) };
};

/** Single payload for dashboard — one React Query key / cache entry. */
export const fetchDashboardBundle = async (
  range: DateRange,
  communityId?: string,
  ignoreCancelled = false,
) => {
  const effectiveRange: DateRange = range.from || range.to
    ? range
    : { from: startOfDay(new Date()), to: endOfDay(new Date()) };

  const [kpis, overview, statusDist, topCommunities, topPartners, recentOrders, lowWallet] =
    await Promise.all([
      fetchDashboardKPIs(effectiveRange, communityId, ignoreCancelled),
      fetchOrdersOverview(effectiveRange, communityId, ignoreCancelled),
      fetchOrderStatusDistribution(effectiveRange, communityId, ignoreCancelled),
      fetchTopCommunities(effectiveRange, 5, communityId, ignoreCancelled),
      fetchTopPartners(effectiveRange, 5, communityId, ignoreCancelled),
      fetchRecentOrders(8, communityId, effectiveRange, ignoreCancelled),
      fetchLowWalletUsers(100, 5, communityId),
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
