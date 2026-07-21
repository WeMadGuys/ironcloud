import { supabase } from '../../../lib/supabase';
import {
  getJobDayOffset,
  getRiderId,
  isDateOnDay,
  resolveButtonState,
  type FlatButtonState,
} from './job-utils';

export type JobFilter = 'all' | 'pickup' | 'delivery' | 'pending' | 'completed' | 'issues';

export type RiderJobRow = {
  id: string;
  job_type: 'pickup' | 'delivery';
  status: string;
  order: {
    id: string;
    order_number: string;
    status: string;
    special_instructions: string | null;
    address: {
      tower: string | null;
      flat_number: string;
      community: { id: string; name: string } | null;
    } | null;
    pickup_slot: { window_start: string; window_end: string } | null;
    delivery_slot: { window_start: string; window_end: string } | null;
    order_items: { quantity: number }[] | null;
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
};

export type CommunityJobSummary = {
  communityId: string;
  communityName: string;
  towersLabel: string;
  totalJobs: number;
  completedJobs: number;
  pickupCount: number;
  deliveryCount: number;
  status: 'active' | 'in_progress' | 'upcoming';
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

const JOB_SELECT = `
  id,
  job_type,
  status,
  order:order_id (
    id,
    order_number,
    status,
    special_instructions,
    address:address_id (
      tower,
      flat_number,
      community:community_id (id, name)
    ),
    pickup_slot:pickup_slot_id (window_start, window_end),
    delivery_slot:delivery_slot_id (window_start, window_end),
    order_items (quantity)
  )
`;

async function fetchRiderJobs(): Promise<RiderJobRow[]> {
  const riderId = await getRiderId();
  if (!riderId) return [];

  const { data, error } = await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .select(JOB_SELECT)
    .eq('rider_id', riderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Jobs] fetch error:', error);
    return [];
  }

  return (data as RiderJobRow[]) || [];
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

function mapToFlatJob(job: RiderJobRow): FlatJob | null {
  const order = job.order;
  if (!order?.address?.community) return null;

  const garmentCount = (order.order_items || []).reduce(
    (sum, item) => sum + (item.quantity || 0),
    0,
  );

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
  };
}

function matchesFilter(job: RiderJobRow, filter: JobFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pickup') return job.job_type === 'pickup';
  if (filter === 'delivery') return job.job_type === 'delivery';
  if (filter === 'pending') return job.status !== 'completed';
  if (filter === 'completed') return job.status === 'completed';
  if (filter === 'issues') return job.status === 'failed';
  return true;
}

export async function getJobsForDay(
  dayOffset: number,
  filter: JobFilter = 'all',
): Promise<FlatJob[]> {
  const jobs = await fetchRiderJobs();
  return jobs
    .filter((job) => jobMatchesDay(job, dayOffset) && matchesFilter(job, filter))
    .map(mapToFlatJob)
    .filter((job): job is FlatJob => job !== null);
}

export async function getDashboardSummary(dayOffset: number): Promise<DashboardSummary> {
  const jobs = await fetchRiderJobs();
  const dayJobs = jobs.filter((job) => jobMatchesDay(job, dayOffset));
  const flats = dayJobs.map(mapToFlatJob).filter((j): j is FlatJob => j !== null);

  const pickupOrders = flats.filter((j) => j.jobType === 'pickup').length;
  const deliveryOrders = flats.filter((j) => j.jobType === 'delivery').length;
  const totalGarments = flats.reduce((sum, j) => sum + j.garmentCount, 0);
  const communityIds = new Set(flats.map((j) => j.communityId));
  const pendingJobs = flats.filter((j) => j.jobStatus !== 'completed').length;

  const communities = await getCommunityJobs(dayOffset);
  const nextCommunity =
    communities.find((c) => c.completedJobs < c.totalJobs) || communities[0] || null;

  const jobDayOffsets = new Set<number>();
  for (const job of jobs) {
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
): Promise<CommunityJobSummary[]> {
  const flats = await getJobsForDay(dayOffset, filter);
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
        status: flat.jobStatus === 'completed' ? 'upcoming' : 'active',
        towers: new Set([flat.tower]),
      });
    } else {
      existing.totalJobs += 1;
      if (flat.jobStatus === 'completed') existing.completedJobs += 1;
      if (flat.jobType === 'pickup') existing.pickupCount += 1;
      if (flat.jobType === 'delivery') existing.deliveryCount += 1;
      existing.towers.add(flat.tower);
      if (flat.jobStatus !== 'completed') existing.status = 'in_progress';
    }
  }

  return [...map.values()].map(({ towers, ...rest }) => ({
    ...rest,
    towersLabel:
      towers.size > 1 ? `Towers ${[...towers].sort().join(', ')}` : `Tower ${[...towers][0]}`,
    status:
      rest.completedJobs === 0
        ? 'active'
        : rest.completedJobs < rest.totalJobs
        ? 'in_progress'
        : 'upcoming',
  }));
}

export async function getTowerJobs(
  communityId: string,
  dayOffset: number,
  filter: JobFilter = 'all',
): Promise<{ tower: string; totalJobs: number; completedJobs: number }[]> {
  const flats = (await getJobsForDay(dayOffset, filter)).filter(
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
): Promise<FlatJob[]> {
  return (await getJobsForDay(dayOffset, filter))
    .filter((f) => f.communityId === communityId && f.tower === tower)
    .sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true }));
}

export async function getRiderProfile(): Promise<{
  fullName: string;
  phone: string;
} | null> {
  const riderId = await getRiderId();
  if (!riderId) return null;

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
}
