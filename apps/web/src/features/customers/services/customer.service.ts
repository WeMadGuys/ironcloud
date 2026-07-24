import { getSupabase } from '@/lib/supabase';

export type CustomerListParams = {
  page: number;
  pageSize: number;
  search?: string;
};

export const fetchCustomers = async (params: CustomerListParams) => {
  const supabase = getSupabase();
  const { page, pageSize, search } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('profiles')
    .select('id, full_name, phone, email, created_at', { count: 'exact' })
    .eq('role', 'customer');

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);
  return { data: data ?? [], total: count ?? 0 };
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
