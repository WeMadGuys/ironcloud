import { getSupabase } from '@/lib/supabase';

export const fetchPartners = async (page = 1, pageSize = 25, search?: string) => {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from('partners').select('*', { count: 'exact' });
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, count } = await query.order('created_at', { ascending: false }).range(from, to);
  return { data: data ?? [], total: count ?? 0 };
};

export const fetchPartnerById = async (partnerId: string) => {
  const supabase = getSupabase();
  const [partner, orders, communities, settlements] = await Promise.all([
    supabase.from('partners').select('*').eq('id', partnerId).single(),
    supabase.from('partner_orders').select('order_id, orders(status, total_amount, created_at)').eq('partner_id', partnerId),
    supabase.from('partner_communities').select('community_id, communities(name)').eq('partner_id', partnerId),
    supabase.from('settlements').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false }),
  ]);

  const orderList = (orders.data ?? []).map((po) => po.orders).filter(Boolean);
  const revenue = orderList.reduce((s, o) => s + Number((o as { total_amount: number }).total_amount ?? 0), 0);

  return {
    partner: partner.data,
    orders: orderList,
    communities: communities.data ?? [],
    settlements: settlements.data ?? [],
    revenue,
    orderCount: orderList.length,
  };
};
