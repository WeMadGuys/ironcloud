import { createTtlCache } from '../../../lib/ttl-cache';
import { supabase } from '../../../lib/supabase';
import {
  getJobDayOffset,
  getRiderId,
  isDateOnDay,
  resolveButtonState,
  type FlatButtonState,
} from './job-utils';

export type JobFilter = 'all' | 'pickup' | 'delivery' | 'pending' | 'completed' | 'issues';

export type JobItemSummary = {
  name: string;
  quantity: number;
};

type EstimatedGarmentRow = {
  service_id?: string;
  serviceId?: string;
  name?: string;
  quantity?: number;
};

export type RiderJobRow = {
  id: string;
  job_type: 'pickup' | 'delivery';
  status: string;
  scheduled_start: string | null;
  order: {
    id: string;
    order_number: string;
    status: string;
    special_instructions: string | null;
    estimated_amount: number | null;
    estimated_garments: EstimatedGarmentRow[] | null;
    customer: {
      full_name: string | null;
      phone: string | null;
    } | null;
    address: {
      tower: string | null;
      flat_number: string;
      community: { id: string; name: string } | null;
    } | null;
    pickup_slot: { window_start: string; window_end: string } | null;
    delivery_slot: { window_start: string; window_end: string } | null;
    order_items: {
      quantity: number;
      service: { name: string } | null;
    }[] | null;
  } | null;
};

export type FlatJob = {
  jobId: string;
  orderId: string;
  orderNumber: string;
  jobType: 'pickup' | 'delivery';
  jobStatus: string;
  orderStatus: string;
  communityId: string;
  communityName: string;
  tower: string;
  flatNumber: string;
  specialInstructions: string | null;
  buttonState: FlatButtonState;
  garmentCount: number;
  /** Confirmed items, else customer estimate — for list preview */
  itemSummary: JobItemSummary[];
  itemsFromEstimate: boolean;
  customerName: string | null;
  customerPhone: string | null;
};

export type CommunityJobSummary = {
  communityId: string;
  communityName: string;
  towersLabel: string;
  totalJobs: number;
  completedJobs: number;
  pickupCount: number;
  deliveryCount: number;
  status: 'active' | 'in_progress' | 'upcoming' | 'completed';
};

export type DashboardSummary = {
  pickupOrders: number;
  deliveryOrders: number;
  totalGarments: number;
  communities: number;
  pendingJobs: number;
  nextCommunity: CommunityJobSummary | null;
  jobDayOffsets: number[];
};

const JOBS_CACHE_TTL_MS = 20_000;
const JOBS_LIST_LIMIT = 150;

const JOB_SELECT = `
  id,
  job_type,
  status,
  scheduled_start,
  order:order_id (
    id,
    order_number,
    status,
    special_instructions,
    estimated_amount,
    estimated_garments,
    customer:customer_id (
      full_name,
      phone
    ),
    address:address_id (
      tower,
      flat_number,
      community:community_id (id, name)
    ),
    pickup_slot:pickup_slot_id (window_start, window_end),
    delivery_slot:delivery_slot_id (window_start, window_end),
    order_items (
      quantity,
      service:service_id (name)
    )
  )
`;

const jobsCache = createTtlCache<RiderJobRow[]>(JOBS_CACHE_TTL_MS);
const profileCache = createTtlCache<{ fullName: string; phone: string }>(60_000);

export function getCachedRiderJobs(): RiderJobRow[] | null {
  return jobsCache.get();
}

export function clearJobsCache(): void {
  jobsCache.clear();
}

export function clearRiderProfileCache(): void {
  profileCache.clear();
}

async function fetchRiderJobs(options?: { force?: boolean }): Promise<RiderJobRow[]> {
  return jobsCache.getOrFetch(async () => {
    const riderId = await getRiderId();
    if (!riderId) return [];

    // Bound payload: recent jobs are enough for the 7-day strip at ~100 riders.
    const { data, error } = await (supabase
      .from('rider_jobs') as ReturnType<typeof supabase.from>)
      .select(JOB_SELECT)
      .eq('rider_id', riderId)
      .order('created_at', { ascending: false })
      .limit(JOBS_LIST_LIMIT);

    if (error) {
      console.error('[Jobs] fetch error:', error);
      return [];
    }

    return (data as RiderJobRow[]) || [];
  }, options?.force === true);
}

function jobMatchesDay(job: RiderJobRow, dayOffset: number): boolean {
  const order = job.order;
  if (!order) return false;
  const slotIso =
    job.job_type === 'pickup'
      ? order.pickup_slot?.window_start
      : order.delivery_slot?.window_start;
  return isDateOnDay(slotIso, dayOffset);
}

function resolveItemSummary(order: NonNullable<RiderJobRow['order']>): {
  itemSummary: JobItemSummary[];
  garmentCount: number;
  itemsFromEstimate: boolean;
} {
  const confirmed = (order.order_items || [])
    .filter((item) => (item.quantity || 0) > 0)
    .map((item) => ({
      name: item.service?.name || 'Garment',
      quantity: item.quantity || 0,
    }));

  if (confirmed.length > 0) {
    const garmentCount = confirmed.reduce((sum, item) => sum + item.quantity, 0);
    return { itemSummary: confirmed, garmentCount, itemsFromEstimate: false };
  }

  const estimate = (order.estimated_garments || [])
    .map((item) => ({
      name: item.name || 'Garment',
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.quantity > 0);

  const garmentCount = estimate.reduce((sum, item) => sum + item.quantity, 0);
  return {
    itemSummary: estimate,
    garmentCount,
    itemsFromEstimate: estimate.length > 0,
  };
}

function mapToFlatJob(job: RiderJobRow): FlatJob | null {
  const order = job.order;
  if (!order?.address?.community) return null;

  const { itemSummary, garmentCount, itemsFromEstimate } = resolveItemSummary(order);

  return {
    jobId: job.id,
    orderId: order.id,
    orderNumber: order.order_number,
    jobType: job.job_type,
    jobStatus: job.status,
    orderStatus: order.status,
    communityId: order.address.community.id,
    communityName: order.address.community.name,
    tower: order.address.tower || 'Main',
    flatNumber: order.address.flat_number,
    specialInstructions: order.special_instructions,
    buttonState: resolveButtonState(job.job_type, job.status, order.status),
    garmentCount,
    itemSummary,
    itemsFromEstimate,
    customerName: order.customer?.full_name?.trim() || null,
    customerPhone: order.customer?.phone?.trim() || null,
  };
}

/** Cancelled bookings mark jobs `failed` so they leave the queue — keep them out of the main list. */
function isMainQueueJob(job: RiderJobRow): boolean {
  if (job.status === 'failed') return false;
  if (job.order?.status === 'cancelled') return false;
  return true;
}

function matchesFilter(job: RiderJobRow, filter: JobFilter): boolean {
  if (filter === 'issues') return job.status === 'failed';
  if (!isMainQueueJob(job)) return false;
  if (filter === 'all') return true;
  if (filter === 'pickup') return job.job_type === 'pickup';
  if (filter === 'delivery') return job.job_type === 'delivery';
  if (filter === 'pending') return job.status !== 'completed';
  if (filter === 'completed') return job.status === 'completed';
  return true;
}

function resolveCommunityStatus(
  completedJobs: number,
  totalJobs: number,
  dayOffset: number,
): CommunityJobSummary['status'] {
  if (totalJobs > 0 && completedJobs >= totalJobs) return 'completed';
  // Only today's route is actionable — future days stay Upcoming.
  if (dayOffset > 0) return 'upcoming';
  if (completedJobs === 0) return 'active';
  return 'in_progress';
}

function buildCommunitySummaries(
  flats: FlatJob[],
  search = '',
  dayOffset = 0,
): CommunityJobSummary[] {
  const query = search.trim().toLowerCase();
  const filtered = query
    ? flats.filter(
        (f) =>
          f.communityName.toLowerCase().includes(query) ||
          f.tower.toLowerCase().includes(query) ||
          f.flatNumber.toLowerCase().includes(query),
      )
    : flats;

  const map = new Map<string, CommunityJobSummary & { towers: Set<string> }>();

  for (const flat of filtered) {
    const existing = map.get(flat.communityId);
    if (!existing) {
      map.set(flat.communityId, {
        communityId: flat.communityId,
        communityName: flat.communityName,
        towersLabel: '',
        totalJobs: 1,
        completedJobs: flat.jobStatus === 'completed' ? 1 : 0,
        pickupCount: flat.jobType === 'pickup' ? 1 : 0,
        deliveryCount: flat.jobType === 'delivery' ? 1 : 0,
        status: 'active',
        towers: new Set([flat.tower]),
      });
    } else {
      existing.totalJobs += 1;
      if (flat.jobStatus === 'completed') existing.completedJobs += 1;
      if (flat.jobType === 'pickup') existing.pickupCount += 1;
      if (flat.jobType === 'delivery') existing.deliveryCount += 1;
      existing.towers.add(flat.tower);
    }
  }

  return [...map.values()].map(({ towers, ...rest }) => ({
    ...rest,
    towersLabel:
      towers.size > 1
        ? `Towers ${[...towers].sort().join(', ')}`
        : `Tower ${[...towers][0]}`,
    status: resolveCommunityStatus(rest.completedJobs, rest.totalJobs, dayOffset),
  }));
}

export async function getJobsForDay(
  dayOffset: number,
  filter: JobFilter = 'all',
  options?: { force?: boolean },
): Promise<FlatJob[]> {
  const jobs = await fetchRiderJobs(options);
  return jobs
    .filter((job) => jobMatchesDay(job, dayOffset) && matchesFilter(job, filter))
    .map(mapToFlatJob)
    .filter((job): job is FlatJob => job !== null);
}

export async function getDashboardSummary(
  dayOffset: number,
  options?: { force?: boolean },
): Promise<DashboardSummary> {
  const jobs = await fetchRiderJobs(options);
  const dayJobs = jobs.filter(
    (job) => isMainQueueJob(job) && jobMatchesDay(job, dayOffset),
  );
  const flats = dayJobs.map(mapToFlatJob).filter((j): j is FlatJob => j !== null);

  const pickupOrders = flats.filter((j) => j.jobType === 'pickup').length;
  const deliveryOrders = flats.filter((j) => j.jobType === 'delivery').length;
  const totalGarments = flats.reduce((sum, j) => sum + j.garmentCount, 0);
  const communityIds = new Set(flats.map((j) => j.communityId));
  const pendingJobs = flats.filter((j) => j.jobStatus !== 'completed').length;

  // Derive from the same in-memory day set — do not re-fetch.
  const communities = buildCommunitySummaries(flats, '', dayOffset);
  const nextCommunity =
    communities.find((c) => c.completedJobs < c.totalJobs) || communities[0] || null;

  const jobDayOffsets = new Set<number>();
  for (const job of jobs) {
    if (!isMainQueueJob(job)) continue;
    const order = job.order;
    if (!order) continue;
    const offset = getJobDayOffset(
      job.job_type,
      order.pickup_slot?.window_start ?? null,
      order.delivery_slot?.window_start ?? null,
    );
    if (offset != null) jobDayOffsets.add(offset);
  }

  return {
    pickupOrders,
    deliveryOrders,
    totalGarments,
    communities: communityIds.size,
    pendingJobs,
    nextCommunity,
    jobDayOffsets: [...jobDayOffsets].sort((a, b) => a - b),
  };
}

export async function getCommunityJobs(
  dayOffset: number,
  filter: JobFilter = 'all',
  search = '',
  options?: { force?: boolean },
): Promise<CommunityJobSummary[]> {
  const flats = await getJobsForDay(dayOffset, filter, options);
  return buildCommunitySummaries(flats, search, dayOffset);
}

/** One network round-trip for Home: profile + summary + communities. */
export async function getHomeBundle(
  dayOffset: number,
  search = '',
  options?: { force?: boolean },
): Promise<{
  profile: { fullName: string; phone: string } | null;
  summary: DashboardSummary;
  communities: CommunityJobSummary[];
}> {
  const [profile, jobs] = await Promise.all([
    getRiderProfile(options),
    fetchRiderJobs(options),
  ]);

  const dayJobs = jobs.filter(
    (job) => isMainQueueJob(job) && jobMatchesDay(job, dayOffset),
  );
  const flats = dayJobs.map(mapToFlatJob).filter((j): j is FlatJob => j !== null);

  const pickupOrders = flats.filter((j) => j.jobType === 'pickup').length;
  const deliveryOrders = flats.filter((j) => j.jobType === 'delivery').length;
  const totalGarments = flats.reduce((sum, j) => sum + j.garmentCount, 0);
  const communityIds = new Set(flats.map((j) => j.communityId));
  const pendingJobs = flats.filter((j) => j.jobStatus !== 'completed').length;

  const communities = buildCommunitySummaries(flats, search, dayOffset);
  const nextCommunity =
    communities.find((c) => c.completedJobs < c.totalJobs) || communities[0] || null;

  const jobDayOffsets = new Set<number>();
  for (const job of jobs) {
    if (!isMainQueueJob(job)) continue;
    const order = job.order;
    if (!order) continue;
    const offset = getJobDayOffset(
      job.job_type,
      order.pickup_slot?.window_start ?? null,
      order.delivery_slot?.window_start ?? null,
    );
    if (offset != null) jobDayOffsets.add(offset);
  }

  return {
    profile,
    summary: {
      pickupOrders,
      deliveryOrders,
      totalGarments,
      communities: communityIds.size,
      pendingJobs,
      nextCommunity,
      jobDayOffsets: [...jobDayOffsets].sort((a, b) => a - b),
    },
    communities,
  };
}

export async function getTowerJobs(
  communityId: string,
  dayOffset: number,
  filter: JobFilter = 'all',
  options?: { force?: boolean },
): Promise<{ tower: string; totalJobs: number; completedJobs: number }[]> {
  const flats = (await getJobsForDay(dayOffset, filter, options)).filter(
    (f) => f.communityId === communityId,
  );
  const map = new Map<string, { totalJobs: number; completedJobs: number }>();

  for (const flat of flats) {
    const row = map.get(flat.tower) || { totalJobs: 0, completedJobs: 0 };
    row.totalJobs += 1;
    if (flat.jobStatus === 'completed') row.completedJobs += 1;
    map.set(flat.tower, row);
  }

  return [...map.entries()]
    .map(([tower, stats]) => ({ tower, ...stats }))
    .sort((a, b) => a.tower.localeCompare(b.tower));
}

export async function getFlatJobs(
  communityId: string,
  tower: string,
  dayOffset: number,
  filter: JobFilter = 'all',
  options?: { force?: boolean },
): Promise<FlatJob[]> {
  return (await getJobsForDay(dayOffset, filter, options))
    .filter((f) => f.communityId === communityId && f.tower === tower)
    .sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true }));
}

export async function getRiderProfile(options?: {
  force?: boolean;
}): Promise<{
  fullName: string;
  phone: string;
} | null> {
  const riderId = await getRiderId();
  if (!riderId) return null;

  return profileCache.getOrFetch(async () => {
    const { data } = await (supabase
      .from('profiles') as ReturnType<typeof supabase.from>)
      .select('full_name, phone')
      .eq('id', riderId)
      .maybeSingle();

    if (!data) {
      return { fullName: 'Rider', phone: '9876543210' };
    }

    const row = data as { full_name: string | null; phone: string | null };
    return {
      fullName: row.full_name || 'Rider',
      phone: row.phone || '',
    };
  }, options?.force === true);
}
