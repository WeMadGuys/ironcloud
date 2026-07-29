import { castRows } from '@/lib/query';
import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

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
const IN_PROGRESS_STATUSES = ['picked_up', 'warehouse_received', 'sorting', 'ironing', 'quality_check', 'packed', 'ready_for_delivery'];
const OUT_FOR_DELIVERY_STATUSES = ['delivery_assigned', 'out_for_delivery'];
const DELIVERED_STATUSES = ['delivered', 'completed', 'rated'];

/** Rankings use a recent window — all-time full-table scans are wrong past PostgREST row caps. */
const RANKING_LOOKBACK_DAYS = 30;

export const fetchDashboardKPIs = async (date: Date): Promise<DashboardKPIs> => {
  const supabase = getSupabase();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const prevStart = startOfDay(prevDate).toISOString();
  const prevEnd = endOfDay(prevDate).toISOString();

  const [ordersToday, ordersYesterday, wallets, partners, riders] = await Promise.all([
    supabase
      .from('orders')
      .select('status, total_amount, customer_id')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd),
    // ~1k wallet rows is fine for 5 admins; prefer sum RPC later if this grows.
    supabase.from('wallets').select('balance'),
    supabase.from('partners').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('riders').select('id', { count: 'exact', head: true }),
  ]);

  const orders = castRows<{
    status: string;
    total_amount: number;
    customer_id: string;
  }>(ordersToday.data);

  const uniqueCustomers = new Set(orders.map((o) => o.customer_id));

  const countByStatus = (statuses: string[]) =>
    orders.filter((o) => statuses.includes(o.status)).length;

  const revenueToday = orders.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const walletBalance = castRows<{ balance: number }>(wallets.data).reduce(
    (s, w) => s + Number(w.balance ?? 0),
    0,
  );

  const totalToday = orders.length;
  const totalYesterday = ordersYesterday.count ?? 0;

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

export const fetchOrdersOverview = async (days: number) => {
  const supabase = getSupabase();
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('orders')
    .select('created_at')
    .gte('created_at', start.toISOString());

  const counts: Record<string, number> = {};
  (data ?? []).forEach((o) => {
    const date = o.created_at.split('T')[0];
    counts[date] = (counts[date] ?? 0) + 1;
  });

  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
};

export const fetchOrderStatusDistribution = async (date: Date) => {
  const supabase = getSupabase();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const { data } = await supabase
    .from('orders')
    .select('status')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const counts: Record<string, number> = {};
  (data ?? []).forEach((o) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  });

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

export const fetchRecentOrders = async (limit = 8) => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, created_at, total_amount,
      profiles!orders_customer_id_fkey(full_name),
      addresses(flat_number, tower),
      communities(name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

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

/** Single payload for dashboard — one React Query key / cache entry. */
export const fetchDashboardBundle = async (date: Date, chartDays: number) => {
  const [kpis, overview, statusDist, topCommunities, topPartners, recentOrders, lowWallet] =
    await Promise.all([
      fetchDashboardKPIs(date),
      fetchOrdersOverview(chartDays),
      fetchOrderStatusDistribution(date),
      fetchTopCommunities(),
      fetchTopPartners(),
      fetchRecentOrders(),
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
