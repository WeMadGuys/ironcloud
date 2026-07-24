import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

export const fetchAnalyticsOverview = async (date: Date) => {
  const supabase = getSupabase();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(date);
  monthStart.setDate(monthStart.getDate() - 30);

  const [
    ordersToday,
    ordersWeek,
    ordersMonth,
    customers,
    partners,
    riders,
    revenueData,
    cancelled,
    refunds,
  ] = await Promise.all([
    supabase.from('orders').select('customer_id').gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase.from('orders').select('customer_id, total_amount').gte('created_at', weekStart.toISOString()),
    supabase.from('orders').select('customer_id, total_amount, created_at').gte('created_at', monthStart.toISOString()),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('partners').select('id', { count: 'exact', head: true }),
    supabase.from('riders').select('id', { count: 'exact', head: true }),
    supabase.from('orders').select('total_amount, created_at, community_id').gte('created_at', monthStart.toISOString()),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['refund_initiated', 'refund_completed']),
  ]);

  const dau = new Set((ordersToday.data ?? []).map((o) => o.customer_id)).size;
  const wau = new Set((ordersWeek.data ?? []).map((o) => o.customer_id)).size;
  const mau = new Set((ordersMonth.data ?? []).map((o) => o.customer_id)).size;

  const totalOrders = ordersMonth.data?.length ?? 0;
  const revenue = (ordersMonth.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const cancellationRate = totalOrders ? ((cancelled.count ?? 0) / totalOrders) * 100 : 0;
  const refundRate = totalOrders ? ((refunds.count ?? 0) / totalOrders) * 100 : 0;

  const revenueByDay: Record<string, number> = {};
  (revenueData.data ?? []).forEach((o) => {
    const day = o.created_at.split('T')[0];
    revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(o.total_amount ?? 0);
  });

  const revenueTrend = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  return {
    dau,
    wau,
    mau,
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
  const { data } = await supabase
    .from('orders')
    .select('total_amount, community_id, communities(name)');

  const perf: Record<string, { name: string; revenue: number; orders: number }> = {};
  (data ?? []).forEach((o) => {
    const id = o.community_id;
    const name = (o.communities as { name: string } | null)?.name ?? 'Unknown';
    if (!perf[id]) perf[id] = { name, revenue: 0, orders: 0 };
    perf[id].revenue += Number(o.total_amount ?? 0);
    perf[id].orders++;
  });

  return Object.values(perf).sort((a, b) => b.revenue - a.revenue);
};
