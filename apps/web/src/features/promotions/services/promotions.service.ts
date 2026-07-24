import { getSupabase } from '@/lib/supabase';

export const fetchCoupons = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  return data ?? [];
};

export const fetchCampaigns = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  return data ?? [];
};

export const fetchBanners = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('banners').select('*').order('created_at', { ascending: false });
  return data ?? [];
};

export const fetchReferrals = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('referrals').select('*, referrer:profiles!referrals_referrer_id_fkey(full_name)').order('created_at', { ascending: false });
  return data ?? [];
};
