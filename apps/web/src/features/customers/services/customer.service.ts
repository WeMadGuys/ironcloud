import { getSupabase } from '@/lib/supabase';

export type CustomerListParams = {
  page: number;
  pageSize: number;
  search?: string;
  communityId?: string;
  city?: string;
};

export type CustomerListRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  community_id: string | null;
  community_name: string | null;
  city: string | null;
};

type AddressEmbed = {
  customer_id: string;
  is_default: boolean;
  community_id: string;
  communities: { id: string; name: string; city: string } | null;
};

async function customerIdsForLocation(
  communityId?: string,
  city?: string,
): Promise<string[] | null> {
  if (!communityId && !city) return null;

  const supabase = getSupabase();
  let query = supabase
    .from('addresses')
    .select('customer_id, communities!inner(city)');

  if (communityId) {
    query = query.eq('community_id', communityId);
  }
  if (city) {
    query = query.eq('communities.city', city);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[customerIdsForLocation]', error.message);
    return [];
  }

  return [...new Set((data ?? []).map((row) => row.customer_id as string))];
}

function pickAddressForCustomer(
  customerId: string,
  addresses: AddressEmbed[],
): AddressEmbed | null {
  const mine = addresses.filter((a) => a.customer_id === customerId);
  if (mine.length === 0) return null;
  return mine.find((a) => a.is_default) ?? mine[0];
}

export const fetchCustomers = async (
  params: CustomerListParams,
): Promise<{ data: CustomerListRow[]; total: number }> => {
  const supabase = getSupabase();
  const { page, pageSize, search, communityId, city } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const locationIds = await customerIdsForLocation(communityId, city);
  if (locationIds && locationIds.length === 0) {
    return { data: [], total: 0 };
  }

  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, email, created_at', { count: 'exact' })
    .eq('role', 'customer');

  if (locationIds) {
    query = query.in('id', locationIds);
  }

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[fetchCustomers]', error.message);
    return { data: [], total: 0 };
  }

  const profiles = data ?? [];
  if (profiles.length === 0) {
    return { data: [], total: count ?? 0 };
  }

  const { data: addressRows } = await supabase
    .from('addresses')
    .select('customer_id, is_default, community_id, communities(id, name, city)')
    .in(
      'customer_id',
      profiles.map((p) => p.id),
    );

  const addresses = (addressRows ?? []) as unknown as AddressEmbed[];

  const rows: CustomerListRow[] = profiles.map((p) => {
    const addr = pickAddressForCustomer(p.id, addresses);
    return {
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      email: p.email,
      created_at: p.created_at,
      community_id: addr?.community_id ?? null,
      community_name: addr?.communities?.name ?? null,
      city: addr?.communities?.city ?? null,
    };
  });

  return { data: rows, total: count ?? 0 };
};

export const fetchCustomerById = async (customerId: string) => {
  const supabase = getSupabase();
  const [profile, wallet, orders, addresses, subscriptions, ratings, tickets] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', customerId).single(),
    supabase.from('wallets').select('*, wallet_transactions(*)').eq('customer_id', customerId).single(),
    supabase.from('orders').select('id, order_number, status, total_amount, created_at').eq('customer_id', customerId).order('created_at', { ascending: false }).limit(20),
    supabase.from('addresses').select('*, communities(name)').eq('customer_id', customerId),
    supabase.from('subscriptions').select('*').eq('customer_id', customerId),
    supabase.from('ratings').select('*').eq('customer_id', customerId),
    supabase.from('support_tickets').select('*').eq('customer_id', customerId),
  ]);

  return {
    profile: profile.data,
    wallet: wallet.data,
    orders: orders.data ?? [],
    addresses: addresses.data ?? [],
    subscriptions: subscriptions.data ?? [],
    ratings: ratings.data ?? [],
    tickets: tickets.data ?? [],
  };
};

export const fetchCustomerStats = async (customerId: string) => {
  const supabase = getSupabase();
  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount, created_at')
    .eq('customer_id', customerId);

  const orderList = orders ?? [];
  const ltv = orderList.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const orderCount = orderList.length;
  const lastOrder = orderList.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  return { ltv, orderCount, lastOrderDate: lastOrder?.created_at ?? null, aov: orderCount ? ltv / orderCount : 0 };
};
