import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

export type UpdateProfileData = {
  fullName: string;
  email?: string;
};

export type CreateAddressData = {
  communityId: string;
  tower?: string;
  flatNumber: string;
};

export type OnboardingData = {
  profile: UpdateProfileData;
  address: CreateAddressData;
  promoCode?: string;
};

export type AddressResult = {
  id: string;
  customer_id: string;
  community_id: string;
  tower: string | null;
  flat_number: string;
  is_default: boolean;
};

export type CouponResult = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
};

export type UserProfileData = {
  fullName: string;
  phone: string;
  email: string | null;
  apartment: string;
  tower: string | null;
  flatNumber: string;
};

let cachedProfile: UserProfileData | null = null;

export function getCachedProfile(): UserProfileData | null {
  return cachedProfile;
}

export function clearProfileCache(): void {
  cachedProfile = null;
}

/**
 * Loads the current user's profile and default address.
 * Results are cached so profile screens can render immediately after home prefetch.
 */
export async function fetchUserProfile(): Promise<UserProfileData | null> {
  const userId = await getCurrentUserId();

  const { data: profileData } = await (supabase
    .from('profiles') as ReturnType<typeof supabase.from>)
    .select('full_name, phone, email')
    .eq('id', userId)
    .maybeSingle();

  const { data: addressData } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .select(`
      tower,
      flat_number,
      community:community_id (name)
    `)
    .eq('customer_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  const communityName =
    (addressData as { community: { name: string } | null } | null)?.community
      ?.name || 'Not set';

  const row = profileData as {
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;

  const profile: UserProfileData = {
    fullName: row?.full_name?.trim() || 'User',
    phone: row?.phone?.trim() || '',
    email: row?.email ?? null,
    apartment: communityName,
    tower: (addressData as { tower: string | null } | null)?.tower || null,
    flatNumber:
      (addressData as { flat_number: string } | null)?.flat_number || '',
  };

  cachedProfile = profile;
  return profile;
}

/**
 * Gets the current user ID (real or mock).
 * Prefers getSession (local) so onboarding works right after setSession.
 */
async function getCurrentUserId(): Promise<string> {
  if (IS_MOCK_AUTH) {
    return MOCK_USER_ID;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;
  if (sessionUserId) return sessionUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

/**
 * Updates the current user's profile
 */
export async function updateProfile(data: UpdateProfileData) {
  const userId = await getCurrentUserId();

  const { error } = await (supabase
    .from('profiles') as ReturnType<typeof supabase.from>)
    .update({
      full_name: data.fullName,
      email: data.email || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[Profile] Update error:', error.message);
    throw new Error(error.message);
  }

  return { success: true };
}

/**
 * Creates a new address for the current user
 */
export async function createAddress(data: CreateAddressData): Promise<AddressResult> {
  const userId = await getCurrentUserId();

  const { data: address, error } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .insert({
      customer_id: userId,
      community_id: data.communityId,
      tower: data.tower || null,
      flat_number: data.flatNumber,
      is_default: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[Address] Create error:', error.message);
    throw new Error(error.message);
  }

  return address as AddressResult;
}

/**
 * Validates a promo code
 */
export async function validatePromoCode(code: string) {
  const { data: coupon, error } = await (supabase
    .from('coupons') as ReturnType<typeof supabase.from>)
    .select('*')
    .eq('code', code.toUpperCase())
    .gte('valid_to', new Date().toISOString())
    .lte('valid_from', new Date().toISOString())
    .single();

  if (error || !coupon) {
    return { valid: false, message: 'Invalid or expired promo code' };
  }

  const typedCoupon = coupon as CouponResult;

  if (typedCoupon.usage_limit && typedCoupon.used_count >= typedCoupon.usage_limit) {
    return { valid: false, message: 'Promo code usage limit reached' };
  }

  return {
    valid: true,
    coupon: {
      id: typedCoupon.id,
      code: typedCoupon.code,
      discountType: typedCoupon.discount_type,
      discountValue: typedCoupon.discount_value,
      maxDiscount: typedCoupon.max_discount,
    },
  };
}

/**
 * Complete onboarding - saves profile and address
 */
export async function completeOnboarding(data: OnboardingData) {
  // Update profile
  await updateProfile(data.profile);
  
  // Create address
  const address = await createAddress(data.address);
  
  return { success: true, addressId: address.id };
}
