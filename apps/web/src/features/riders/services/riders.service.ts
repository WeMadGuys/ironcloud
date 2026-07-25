import { getSupabase } from '@/lib/supabase';

type RiderExtension = {
  vehicle_number: string | null;
  kyc_status: string | null;
  is_active: boolean | null;
  current_lat: number | null;
  current_lng: number | null;
  rating_avg: number | null;
  created_at: string | null;
};

type RiderProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  riders: RiderExtension | RiderExtension[] | null;
};

export type RiderListItem = {
  id: string;
  vehicle_number: string | null;
  kyc_status: string;
  is_active: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating_avg: number;
  created_at: string;
  profiles: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  };
};

const getRiderExtension = (riders: RiderProfileRow['riders']): RiderExtension | null => {
  if (!riders) return null;
  return Array.isArray(riders) ? (riders[0] ?? null) : riders;
};

const mapProfileToRider = (profile: RiderProfileRow): RiderListItem => {
  const rider = getRiderExtension(profile.riders);

  return {
    id: profile.id,
    vehicle_number: rider?.vehicle_number ?? null,
    kyc_status: rider?.kyc_status ?? 'pending',
    is_active: Boolean(rider?.is_active),
    current_lat: rider?.current_lat ?? null,
    current_lng: rider?.current_lng ?? null,
    rating_avg: Number(rider?.rating_avg ?? 5),
    created_at: rider?.created_at ?? profile.created_at,
    profiles: {
      full_name: profile.full_name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
    },
  };
};

export const fetchRiders = async (page = 1, pageSize = 25) => {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, avatar_url, created_at, riders(vehicle_number, kyc_status, is_active, current_lat, current_lng, rating_avg, created_at)',
      { count: 'exact' },
    )
    .eq('role', 'rider')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[fetchRiders]', error.message);
    return { data: [], total: 0 };
  }

  return {
    data: (data ?? []).map((row) => mapProfileToRider(row as RiderProfileRow)),
    total: count ?? 0,
  };
};

export const fetchRiderById = async (riderId: string) => {
  const supabase = getSupabase();
  const [profileResult, jobs, communities, ratings] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        'id, full_name, phone, avatar_url, created_at, riders(vehicle_number, kyc_status, is_active, current_lat, current_lng, rating_avg, created_at)',
      )
      .eq('id', riderId)
      .eq('role', 'rider')
      .single(),
    supabase
      .from('rider_jobs')
      .select('*, orders(order_number, total_amount)')
      .eq('rider_id', riderId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('rider_communities')
      .select('community_id')
      .eq('rider_id', riderId),
    supabase.from('ratings').select('rider_rating').not('rider_rating', 'is', null),
  ]);

  const profile = profileResult.data as RiderProfileRow | null;
  const riderExtension = profile ? getRiderExtension(profile.riders) : null;

  const rider = profile
    ? {
        id: profile.id,
        vehicle_number: riderExtension?.vehicle_number ?? null,
        kyc_status: riderExtension?.kyc_status ?? 'pending',
        is_active: Boolean(riderExtension?.is_active),
        current_lat: riderExtension?.current_lat ?? null,
        current_lng: riderExtension?.current_lng ?? null,
        rating_avg: Number(riderExtension?.rating_avg ?? 5),
        created_at: riderExtension?.created_at ?? profile.created_at,
        profiles: {
          full_name: profile.full_name,
          phone: profile.phone,
          avatar_url: profile.avatar_url,
        },
      }
    : null;

  const communityLinks = communities.data ?? [];
  const communityIds = communityLinks.map((row) => row.community_id);
  let communityRows: { community_id: string; communities: { name: string } | null }[] = [];

  if (communityIds.length > 0) {
    const { data: communityData } = await supabase
      .from('communities')
      .select('id, name')
      .in('id', communityIds);

    const nameById = new Map((communityData ?? []).map((c) => [c.id, c.name]));
    communityRows = communityLinks.map((row) => ({
      community_id: row.community_id,
      communities: nameById.has(row.community_id)
        ? { name: nameById.get(row.community_id)! }
        : null,
    }));
  }

  const jobsList = jobs.data ?? [];
  const completed = jobsList.filter((j) => j.status === 'completed').length;
  const failed = jobsList.filter((j) => j.status === 'failed').length;
  const pickupJobs = jobsList.filter((j) => j.job_type === 'pickup');
  const deliveryJobs = jobsList.filter((j) => j.job_type === 'delivery');

  return {
    rider,
    jobs: jobsList,
    communities: communityRows,
    stats: {
      totalJobs: jobsList.length,
      completed,
      failed,
      pickupSuccess: pickupJobs.length
        ? (pickupJobs.filter((j) => j.status === 'completed').length / pickupJobs.length) * 100
        : 0,
      deliverySuccess: deliveryJobs.length
        ? (deliveryJobs.filter((j) => j.status === 'completed').length / deliveryJobs.length) * 100
        : 0,
    },
  };
};
