import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

const PERFORMANCE_LOOKBACK_DAYS = 30;

export const fetchAnalyticsOverview = async (date: Date) => {
  const supabase = getSupabase();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(date);
  monthStart.setDate(monthStart.getDate() - 30);
  monthStart.setHours(0, 0, 0, 0);

  // One month-range order pull + head counts — avoid overlapping full scans.
  const [
    ordersMonth,
    customers,
    partners,
    riders,
    cancelled,
    refunds,
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('customer_id, total_amount, created_at, status')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', dayEnd),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('partners').select('id', { count: 'exact', head: true }),
    supabase.from('riders').select('id', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'cancelled')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', dayEnd),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['refund_initiated', 'refund_completed'])
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', dayEnd),
  ]);

  const monthRows = ordersMonth.data ?? [];
  const weekStartMs = weekStart.getTime();
  const dayStartMs = new Date(dayStart).getTime();
  const dayEndMs = new Date(dayEnd).getTime();

  const dau = new Set<string>();
  const wau = new Set<string>();
  const mau = new Set<string>();
  let revenue = 0;
  const revenueByDay: Record<string, number> = {};

  for (const o of monthRows) {
    const createdMs = new Date(o.created_at).getTime();
    mau.add(o.customer_id);
    if (createdMs >= weekStartMs) wau.add(o.customer_id);
    if (createdMs >= dayStartMs && createdMs <= dayEndMs) dau.add(o.customer_id);

    const amount = Number(o.total_amount ?? 0);
    revenue += amount;
    const day = o.created_at.split('T')[0];
    revenueByDay[day] = (revenueByDay[day] ?? 0) + amount;
  }

  const totalOrders = monthRows.length;
  const cancellationRate = totalOrders ? ((cancelled.count ?? 0) / totalOrders) * 100 : 0;
  const refundRate = totalOrders ? ((refunds.count ?? 0) / totalOrders) * 100 : 0;

  const revenueTrend = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, value]) => ({ date: d, value }));

  return {
    dau: dau.size,
    wau: wau.size,
    mau: mau.size,
    totalCustomers: customers.count ?? 0,
    totalPartners: partners.count ?? 0,
    totalRiders: riders.count ?? 0,
    totalOrders,
    revenue,
    cancellationRate,
    refundRate,
    aov: totalOrders ? revenue / totalOrders : 0,
    revenueTrend,
  };
};

export const fetchCommunityPerformance = async () => {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - PERFORMANCE_LOOKBACK_DAYS);
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('orders')
    .select('total_amount, community_id, communities(name)')
    .gte('created_at', since.toISOString())
    .not('community_id', 'is', null);

  const perf: Record<string, { name: string; revenue: number; orders: number }> = {};
  (data ?? []).forEach((o) => {
    const id = o.community_id;
    if (!id) return;
    const name = (o.communities as { name: string } | null)?.name ?? 'Unknown';
    if (!perf[id]) perf[id] = { name, revenue: 0, orders: 0 };
    perf[id].revenue += Number(o.total_amount ?? 0);
    perf[id].orders++;
  });

  return Object.values(perf).sort((a, b) => b.revenue - a.revenue);
};

export const fetchAnalyticsBundle = async (date: Date) => {
  const [overview, communities] = await Promise.all([
    fetchAnalyticsOverview(date),
    fetchCommunityPerformance(),
  ]);
  return { overview, communities };
};
