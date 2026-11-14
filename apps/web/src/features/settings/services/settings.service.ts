import { getSupabase } from '@/lib/supabase';

export const fetchSystemSettings = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('system_settings').select('*');
  return data ?? [];
};

export const fetchRolePermissions = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('role_permissions').select('*');
  return data ?? [];
};

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
    '*, services(name, garment_category), communities(name), profiles!pricing_rules_user_id_fkey(full_name, phone)',
    '*, services(name), communities(name), profiles!pricing_rules_user_id_fkey(full_name, phone)',
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
  const withCategory = await supabase
    .from('services')
    .select('id, name, garment_category')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (!withCategory.error) return withCategory.data ?? [];

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
  return (data ?? []).map((service) => ({ ...service, garment_category: 'Others' }));
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
