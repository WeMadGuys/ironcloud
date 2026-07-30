import { getSupabase } from '@/lib/supabase';

const BANNER_BUCKET = 'banners';
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const ALLOWED_BANNER_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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

function extensionForMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

/** Upload a banner image; returns a cache-busted public URL. */
export async function uploadBannerImage(file: File): Promise<string> {
  if (!ALLOWED_BANNER_TYPES.has(file.type)) {
    throw new Error('Use a JPEG, PNG, or WebP image');
  }
  if (file.size > MAX_BANNER_BYTES) {
    throw new Error('Image must be 5 MB or smaller');
  }

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Please sign in again to upload images');
  }

  const ext = extensionForMime(file.type);
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BANNER_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: urlData } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);
  return `${urlData.publicUrl}?v=${Date.now()}`;
}

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
