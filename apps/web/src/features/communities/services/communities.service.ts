import { getSupabase } from '@/lib/supabase';

export const fetchCommunities = async (page = 1, pageSize = 25, search?: string) => {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('communities').select('*', { count: 'exact' });
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);
  return { data: data ?? [], total: count ?? 0 };
};

export type CommunityOption = {
  id: string;
  name: string;
  city: string;
  status: string | null;
};

export const fetchCommunityOptions = async (): Promise<CommunityOption[]> => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('communities')
    .select('id, name, city, status')
    .order('name', { ascending: true });

  if (error) {
    console.error('[fetchCommunityOptions]', error.message);
    return [];
  }

  return data ?? [];
};

export type CommunityRiderRow = {
  rider_id: string;
  full_name: string | null;
  phone: string | null;
};

export const fetchCommunityRiders = async (communityId: string): Promise<CommunityRiderRow[]> => {
  const supabase = getSupabase();

  // Keep this as a simple select — nested riders→profiles embeds fail under RLS/PostgREST
  // and were returning [] even after a successful assign.
  const { data, error } = await supabase
    .from('rider_communities')
    .select('rider_id')
    .eq('community_id', communityId);

  if (error) {
    console.error('[fetchCommunityRiders]', error.message);
    return [];
  }

  const riderIds = (data ?? []).map((row) => row.rider_id);
  if (riderIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', riderIds)
    .eq('role', 'rider');

  if (profileError) {
    console.error('[fetchCommunityRiders profiles]', profileError.message);
  }

  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return riderIds.map((rider_id) => {
    const profile = byId.get(rider_id);
    return {
      rider_id,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
    };
  });
};

export type TowerRevenue = {
  tower: string;
  orders: number;
  revenue: number;
};

export const fetchCommunityById = async (communityId: string) => {
  const supabase = getSupabase();
  const [community, addresses, orders] = await Promise.all([
    supabase.from('communities').select('*').eq('id', communityId).single(),
    supabase.from('addresses').select('id, tower, flat_number, customer_id').eq('community_id', communityId),
    supabase
      .from('orders')
      .select('id, total_amount, status, created_at, address_id')
      .eq('community_id', communityId),
  ]);

  const addressList = addresses.data ?? [];
  const orderList = orders.data ?? [];
  const revenue = orderList.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  const addressById = new Map(addressList.map((a) => [a.id, a]));
  const towerMap = new Map<string, { orders: number; revenue: number }>();

  for (const order of orderList) {
    const address = order.address_id ? addressById.get(order.address_id) : undefined;
    const tower = address?.tower?.trim() || 'Unspecified';
    const current = towerMap.get(tower) ?? { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += Number(order.total_amount ?? 0);
    towerMap.set(tower, current);
  }

  // Include towers that have addresses but no orders yet
  for (const address of addressList) {
    const tower = address.tower?.trim();
    if (tower && !towerMap.has(tower)) {
      towerMap.set(tower, { orders: 0, revenue: 0 });
    }
  }

  const towerRevenue: TowerRevenue[] = [...towerMap.entries()]
    .map(([tower, stats]) => ({ tower, ...stats }))
    .sort((a, b) => b.revenue - a.revenue || a.tower.localeCompare(b.tower));

  const towers = towerRevenue.map((row) => row.tower);

  return {
    community: community.data,
    addresses: addressList,
    orders: orderList,
    revenue,
    towers,
    towerRevenue,
    customerCount: new Set(addressList.map((a) => a.customer_id)).size,
  };
};
