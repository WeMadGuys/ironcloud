import { getSupabase } from '@/lib/supabase';

export const fetchAuditLogs = async (page = 1, pageSize = 25) => {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from('audit_logs')
    .select('*, profiles(full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  return { data: data ?? [], total: count ?? 0 };
};

export const fetchPricingRules = async () => {
  const supabase = getSupabase();
  const selects = [
    '*, services(name, garment_category, sort_order), communities(name), profiles!pricing_rules_user_id_fkey(full_name, phone)',
    '*, services(name, garment_category), communities(name), profiles!pricing_rules_user_id_fkey(full_name, phone)',
    '*, services(name), communities(name), profiles!pricing_rules_user_id_fkey(full_name, phone)',
    '*, services(name, garment_category, sort_order), communities(name)',
    '*, services(name, garment_category), communities(name)',
    '*, services(name), communities(name)',
  ];

  for (const select of selects) {
    const result = await supabase
      .from('pricing_rules')
      .select(select)
      .order('effective_from', { ascending: false });
    if (!result.error) return result.data ?? [];
    console.warn('[fetchPricingRules]', result.error.message);
  }

  return [];
};

export const fetchActiveServices = async () => {
  const supabase = getSupabase();
  const withOrder = await supabase
    .from('services')
    .select('id, name, garment_category, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (!withOrder.error) return withOrder.data ?? [];

  if (!/sort_order|garment_category/i.test(withOrder.error.message ?? '')) {
    console.error('[fetchActiveServices]', withOrder.error.message);
    return [];
  }

  const withCategory = await supabase
    .from('services')
    .select('id, name, garment_category')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (!withCategory.error) {
    return (withCategory.data ?? []).map((service, index) => ({
      ...service,
      sort_order: index,
    }));
  }

  if (!/garment_category/i.test(withCategory.error.message ?? '')) {
    console.error('[fetchActiveServices]', withCategory.error.message);
    return [];
  }

  console.warn('[fetchActiveServices]', withCategory.error.message);
  const { data, error } = await supabase
    .from('services')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) {
    console.error('[fetchActiveServices]', error.message);
    return [];
  }
  return (data ?? []).map((service, index) => ({
    ...service,
    garment_category: 'Others',
    sort_order: index,
  }));
};

export const fetchGarmentCategories = async (): Promise<string[]> => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('garment_categories')
    .select('name, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.warn('[fetchGarmentCategories]', error.message);
    return [];
  }
  return (data ?? []).map((row: { name: string }) => row.name);
};

export const fetchAppVersionPolicies = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('app_version_policy')
    .select('platform, min_version, store_url, title, message, updated_at')
    .order('platform', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
};

export const fetchServiceSlots = async () => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('service_slots')
    .select('*, communities(name)')
    .order('window_start', { ascending: true })
    .limit(50);
  return data ?? [];
};
