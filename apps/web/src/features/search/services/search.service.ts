import { getSupabase } from '@/lib/supabase';

export type SearchResult = {
  type: 'customer' | 'order' | 'community' | 'partner' | 'rider';
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export const globalSearch = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.length < 2) return [];

  const supabase = getSupabase();
  const q = query.trim();

  const [customers, orders, communities, partners, riders] = await Promise.all([
    supabase.from('profiles').select('id, full_name, phone').eq('role', 'customer').or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(5),
    supabase.from('orders').select('id, order_number').ilike('order_number', `%${q}%`).limit(5),
    supabase.from('communities').select('id, name, city').ilike('name', `%${q}%`).limit(5),
    supabase.from('partners').select('id, name, city').ilike('name', `%${q}%`).limit(5),
    supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'rider')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  (customers.data ?? []).forEach((c) => {
    results.push({
      type: 'customer',
      id: c.id,
      title: c.full_name ?? 'Unknown',
      subtitle: c.phone ?? undefined,
      href: `/admin/customers/${c.id}`,
    });
  });

  (orders.data ?? []).forEach((o) => {
    results.push({
      type: 'order',
      id: o.id,
      title: o.order_number,
      href: `/admin/orders/${o.id}`,
    });
  });

  (communities.data ?? []).forEach((c) => {
    results.push({
      type: 'community',
      id: c.id,
      title: c.name,
      subtitle: c.city,
      href: `/admin/communities/${c.id}`,
    });
  });

  (partners.data ?? []).forEach((p) => {
    results.push({
      type: 'partner',
      id: p.id,
      title: p.name,
      subtitle: p.city ?? undefined,
      href: `/admin/partners/${p.id}`,
    });
  });

  (riders.data ?? []).forEach((r) => {
    results.push({
      type: 'rider',
      id: r.id,
      title: r.full_name ?? 'Rider',
      subtitle: r.phone ?? undefined,
      href: `/admin/riders/${r.id}`,
    });
  });

  return results;
};
