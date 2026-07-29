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

/** @deprecated Prefer fetchReferralPrograms + fetchReferralAttributions */
export const fetchReferrals = async () => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('referrals')
    .select('*, referrer:profiles!referrals_referrer_id_fkey(full_name)')
    .order('created_at', { ascending: false });
  return data ?? [];
};

export const fetchReferralPrograms = async () => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('referral_programs')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
};

export const fetchReferralAttributions = async () => {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('referral_attributions')
    .select(
      `
      *,
      referrer:profiles!referral_attributions_referrer_id_fkey(full_name, phone),
      referee:profiles!referral_attributions_referee_id_fkey(full_name, phone),
      program:referral_programs(name, referrer_reward_amount, referee_reward_amount)
    `,
    )
    .order('created_at', { ascending: false })
    .limit(100);
  return data ?? [];
};
