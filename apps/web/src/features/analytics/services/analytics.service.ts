import { listServiceLineChoices, normalizeServiceLine, serviceLineLabel } from '@ironcloud/db';

import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay, toISODate } from '@/utils/format';

const PERFORMANCE_LOOKBACK_DAYS = 30;
const APP_DOWNLOAD_LOOKBACK_DAYS = 30;
const APP_DOWNLOAD_PAGE_SIZE = 1000;
const OTP_SEND_FAILURE_LIMIT = 200;
const REFUND_STATUSES = new Set(['refund_initiated', 'refund_completed']);

export type OrderExclusion = {
  ignoreCancelled: boolean;
  ignoreFailed: boolean;
};

export type AnalyticsMonthOrder = {
  customer_id: string;
  total_amount: number | string | null;
  created_at: string;
  status: string;
};

export type AnalyticsOverviewCounts = {
  totalCustomers: number;
  totalPartners: number;
  totalRiders: number;
};

export type CommunityOrderRow = {
  total_amount: number | string | null;
  community_id: string | null;
  status: string;
  communities: { name: string } | null;
};

const orderIncluded = (status: string, exclusion: OrderExclusion) => {
  if (exclusion.ignoreCancelled && status === 'cancelled') return false;
  if (exclusion.ignoreFailed && status === 'failed') return false;
  return true;
};

export const summarizeAnalyticsOverview = (
  rows: AnalyticsMonthOrder[],
  counts: AnalyticsOverviewCounts,
  date: Date,
  exclusion: OrderExclusion,
) => {
  const dayStartMs = startOfDay(date).getTime();
  const dayEndMs = endOfDay(date).getTime();
  const weekStart = new Date(date);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);
  const weekStartMs = weekStart.getTime();

  const included = rows.filter((o) => orderIncluded(o.status, exclusion));

  const dau = new Set<string>();
  const wau = new Set<string>();
  const mau = new Set<string>();
  let revenue = 0;
  let cancelled = 0;
  let refunds = 0;
  const revenueByDay: Record<string, number> = {};

  for (const o of included) {
    const createdMs = new Date(o.created_at).getTime();
    mau.add(o.customer_id);
    if (createdMs >= weekStartMs) wau.add(o.customer_id);
    if (createdMs >= dayStartMs && createdMs <= dayEndMs) dau.add(o.customer_id);

    if (o.status === 'cancelled') cancelled++;
    if (REFUND_STATUSES.has(o.status)) refunds++;

    const amount = Number(o.total_amount ?? 0);
    revenue += amount;
    const day = o.created_at.split('T')[0];
    revenueByDay[day] = (revenueByDay[day] ?? 0) + amount;
  }

  const totalOrders = included.length;
  const revenueTrend = Object.entries(revenueByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([d, value]) => ({ date: d, value }));

  return {
    dau: dau.size,
    wau: wau.size,
    mau: mau.size,
    totalCustomers: counts.totalCustomers,
    totalPartners: counts.totalPartners,
    totalRiders: counts.totalRiders,
    totalOrders,
    revenue,
    cancellationRate: totalOrders ? (cancelled / totalOrders) * 100 : 0,
    refundRate: totalOrders ? (refunds / totalOrders) * 100 : 0,
    aov: totalOrders ? revenue / totalOrders : 0,
    revenueTrend,
  };
};

export const summarizeCommunityPerformance = (
  rows: CommunityOrderRow[],
  exclusion: OrderExclusion,
) => {
  const perf: Record<string, { name: string; revenue: number; orders: number }> = {};
  for (const o of rows) {
    if (!orderIncluded(o.status, exclusion)) continue;
    const id = o.community_id;
    if (!id) continue;
    const name = o.communities?.name ?? 'Unknown';
    if (!perf[id]) perf[id] = { name, revenue: 0, orders: 0 };
    perf[id].revenue += Number(o.total_amount ?? 0);
    perf[id].orders++;
  }
  return Object.values(perf).sort((a, b) => b.revenue - a.revenue);
};

export const fetchAnalyticsOverview = async (date: Date) => {
  const supabase = getSupabase();
  const dayEnd = endOfDay(date).toISOString();

  const monthStart = new Date(date);
  monthStart.setDate(monthStart.getDate() - 30);
  monthStart.setHours(0, 0, 0, 0);

  const [ordersMonth, customers, partners, riders] = await Promise.all([
    supabase
      .from('orders')
      .select('customer_id, total_amount, created_at, status')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', dayEnd),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase.from('partners').select('id', { count: 'exact', head: true }),
    supabase.from('riders').select('id', { count: 'exact', head: true }),
  ]);

  return {
    orders: (ordersMonth.data ?? []) as AnalyticsMonthOrder[],
    totalCustomers: customers.count ?? 0,
    totalPartners: partners.count ?? 0,
    totalRiders: riders.count ?? 0,
  };
};

export const fetchCommunityPerformance = async () => {
  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - PERFORMANCE_LOOKBACK_DAYS);
  since.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from('orders')
    .select('total_amount, community_id, status, communities(name)')
    .gte('created_at', since.toISOString())
    .not('community_id', 'is', null);

  return (data ?? []) as CommunityOrderRow[];
};

type AppDownloadEventRow = {
  event_type: 'visit' | 'app_store_click' | 'play_store_click';
  platform: 'ios' | 'android' | 'desktop';
  source: string | null;
  created_at: string;
};

/** Daily /get-app visits and store-bound traffic (auto-redirects + button clicks). */
export const fetchAppDownloadStats = async (date: Date) => {
  const supabase = getSupabase();
  const since = startOfDay(date);
  since.setDate(since.getDate() - (APP_DOWNLOAD_LOOKBACK_DAYS - 1));
  const until = endOfDay(date);

  const rows: AppDownloadEventRow[] = [];
  for (let from = 0; ; from += APP_DOWNLOAD_PAGE_SIZE) {
    const { data } = await supabase
      .from('app_download_events')
      .select('event_type, platform, source, created_at')
      .gte('created_at', since.toISOString())
      .lte('created_at', until.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + APP_DOWNLOAD_PAGE_SIZE - 1);
    const page = (data ?? []) as AppDownloadEventRow[];
    rows.push(...page);
    if (page.length < APP_DOWNLOAD_PAGE_SIZE) break;
  }

  const byDay: Record<string, { date: string; visits: number; appStore: number; playStore: number }> = {};
  for (let i = 0; i < APP_DOWNLOAD_LOOKBACK_DAYS; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = toISODate(d);
    byDay[key] = { date: key, visits: 0, appStore: 0, playStore: 0 };
  }

  const totals = { visits: 0, appStore: 0, playStore: 0, qrVisits: 0 };
  for (const r of rows) {
    const day = byDay[toISODate(new Date(r.created_at))];
    if (!day) continue;

    if (r.event_type === 'visit') {
      day.visits++;
      totals.visits++;
      if (r.source === 'qr') totals.qrVisits++;
    }
    const toAppStore =
      r.event_type === 'app_store_click' || (r.event_type === 'visit' && r.platform === 'ios');
    const toPlayStore =
      r.event_type === 'play_store_click' || (r.event_type === 'visit' && r.platform === 'android');
    if (toAppStore) {
      day.appStore++;
      totals.appStore++;
    }
    if (toPlayStore) {
      day.playStore++;
      totals.playStore++;
    }
  }

  return { trend: Object.values(byDay), totals };
};

export type OtpSendFailureRow = {
  id: string;
  phone: string;
  message: string;
  created_at: string;
};

/** Customer-app Send OTP failures for the selected calendar day. */
export const fetchOtpSendFailures = async (date: Date) => {
  const supabase = getSupabase();
  const { data, count, error } = await supabase
    .from('otp_send_failures')
    .select('id, phone, message, created_at', { count: 'exact' })
    .gte('created_at', startOfDay(date).toISOString())
    .lte('created_at', endOfDay(date).toISOString())
    .order('created_at', { ascending: false })
    .limit(OTP_SEND_FAILURE_LIMIT);

  if (error) {
    console.error('[otp-send-failures]', error.message);
    return { total: 0, rows: [] as OtpSendFailureRow[] };
  }

  return {
    total: count ?? 0,
    rows: (data ?? []) as OtpSendFailureRow[],
  };
};

const SERVICE_BOOKING_PAGE_SIZE = 1000;
const UNKNOWN_SERVICE_LINE = 'unknown';

export type ServiceBookingOrderRow = {
  status: string;
  estimated_garments: unknown;
};

export type ServiceCatalogRow = {
  id: string;
  name: string;
  category: string | null;
};

export type ServiceBookingBar = {
  name: string;
  total: number;
  segments: Record<string, number>;
};

export type ServiceBookingSummary = {
  bars: ServiceBookingBar[];
  lines: { id: string; label: string }[];
};

type EstimateGarment = {
  service_id?: string;
  name?: string;
  quantity?: number;
};

const parseEstimateGarments = (raw: unknown): EstimateGarment[] => {
  if (!Array.isArray(raw)) return [];
  const lines: EstimateGarment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const quantity = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity);
    lines.push({
      service_id: typeof row.service_id === 'string' ? row.service_id : undefined,
      name: typeof row.name === 'string' ? row.name : undefined,
      quantity,
    });
  }
  return lines;
};

/** Pieces booked, grouped by garment name and service line. */
export const summarizeServiceBookings = (
  orders: ServiceBookingOrderRow[],
  services: ServiceCatalogRow[],
  exclusion: OrderExclusion,
): ServiceBookingSummary => {
  const byId = new Map(services.map((service) => [service.id, service]));
  const totals = new Map<string, Map<string, number>>();
  const usedLines = new Set<string>();

  for (const order of orders) {
    if (order.status === 'draft') continue;
    if (!orderIncluded(order.status, exclusion)) continue;

    for (const line of parseEstimateGarments(order.estimated_garments)) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const service = line.service_id ? byId.get(line.service_id) : undefined;
      const name = (service?.name ?? line.name ?? '').trim() || 'Unknown';
      const lineId = service ? normalizeServiceLine(service.category) : UNKNOWN_SERVICE_LINE;
      usedLines.add(lineId);

      let garment = totals.get(name);
      if (!garment) {
        garment = new Map();
        totals.set(name, garment);
      }
      garment.set(lineId, (garment.get(lineId) ?? 0) + qty);
    }
  }

  const bars = Array.from(totals.entries())
    .map(([name, segments]) => {
      const record: Record<string, number> = {};
      let total = 0;
      for (const [lineId, qty] of segments) {
        record[lineId] = qty;
        total += qty;
      }
      return { name, total, segments: record };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return {
    bars,
    lines: listServiceLineChoices(usedLines, true).map((id) => ({
      id,
      label: serviceLineLabel(id),
    })),
  };
};

export const fetchServiceBookingSource = async (
  range: { from: Date; to: Date },
  communityId?: string,
) => {
  const supabase = getSupabase();

  const servicesQuery = supabase.from('services').select('id, name, category');

  const orders: ServiceBookingOrderRow[] = [];
  const loadOrders = async () => {
    for (let from = 0; ; from += SERVICE_BOOKING_PAGE_SIZE) {
      let query = supabase
        .from('orders')
        .select('status, estimated_garments')
        .gte('created_at', range.from.toISOString())
        .lte('created_at', range.to.toISOString());
      if (communityId) query = query.eq('community_id', communityId);
      query = query
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + SERVICE_BOOKING_PAGE_SIZE - 1);

      const { data, error } = await query;
      if (error) {
        console.error('[service-bookings]', error.message);
        break;
      }
      const page = (data ?? []) as ServiceBookingOrderRow[];
      orders.push(...page);
      if (page.length < SERVICE_BOOKING_PAGE_SIZE) break;
    }
  };

  const [servicesRes] = await Promise.all([servicesQuery, loadOrders()]);
  if (servicesRes.error) console.error('[service-bookings]', servicesRes.error.message);

  return {
    orders,
    services: (servicesRes.data ?? []) as ServiceCatalogRow[],
  };
};

export const fetchAnalyticsBundle = async (date: Date) => {
  const [overview, communities, appDownloads, otpSendFailures] = await Promise.all([
    fetchAnalyticsOverview(date),
    fetchCommunityPerformance(),
    fetchAppDownloadStats(date),
    fetchOtpSendFailures(date),
  ]);
  return { overview, communities, appDownloads, otpSendFailures };
};
