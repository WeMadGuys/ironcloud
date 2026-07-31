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
  const withProfiles = await supabase
    .from('pricing_rules')
    .select(
      '*, services(name), communities(name), profiles!pricing_rules_user_id_fkey(full_name, phone)',
    )
    .order('effective_from', { ascending: false });

  if (!withProfiles.error) return withProfiles.data ?? [];

  // Fallback if user_id / FK not migrated yet.
  console.warn('[fetchPricingRules]', withProfiles.error.message);
  const { data } = await supabase
    .from('pricing_rules')
    .select('*, services(name), communities(name)')
    .order('effective_from', { ascending: false });
  return data ?? [];
};

export const fetchActiveServices = async () => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('services')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) {
    console.error('[fetchActiveServices]', error.message);
    return [];
  }
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
