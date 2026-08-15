import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient<any>;

export const BENEFIT_TYPE_REFERRAL = 'referral';
export const BENEFIT_TYPE_COUPON = 'coupon';
export const REFERRAL_WELCOME_BENEFIT_ID = 'welcome';

export type BenefitType = typeof BENEFIT_TYPE_REFERRAL | typeof BENEFIT_TYPE_COUPON;

export type BenefitClaim = {
  phoneDigits: string;
  benefitType: BenefitType;
  benefitId: string;
  claimedBy: string | null;
};

export function normalizePhoneDigits(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export async function resolveUserPhoneDigits(
  admin: AdminClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();

  const fromProfile = normalizePhoneDigits(
    (profile as { phone: string | null } | null)?.phone,
  );
  if (fromProfile) return fromProfile;

  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const user = data.user;
    return (
      normalizePhoneDigits(user?.phone) ??
      normalizePhoneDigits(
        typeof user?.user_metadata?.phone === 'string'
          ? user.user_metadata.phone
          : null,
      )
    );
  } catch {
    return null;
  }
}

export async function getBenefitClaim(
  admin: AdminClient,
  phoneDigits: string,
  benefitType: BenefitType,
  benefitId: string,
): Promise<BenefitClaim | null> {
  const { data } = await admin
    .from('benefit_identity_claims')
    .select('phone_digits, benefit_type, benefit_id, claimed_by')
    .eq('phone_digits', phoneDigits)
    .eq('benefit_type', benefitType)
    .eq('benefit_id', benefitId)
    .maybeSingle();

  if (!data) return null;

  const row = data as {
    phone_digits: string;
    benefit_type: BenefitType;
    benefit_id: string;
    claimed_by: string | null;
  };

  return {
    phoneDigits: row.phone_digits,
    benefitType: row.benefit_type,
    benefitId: row.benefit_id,
    claimedBy: row.claimed_by,
  };
}

export async function hasBenefitClaim(
  admin: AdminClient,
  phoneDigits: string,
  benefitType: BenefitType,
  benefitId: string,
): Promise<boolean> {
  const claim = await getBenefitClaim(admin, phoneDigits, benefitType, benefitId);
  return claim != null;
}

export async function insertBenefitClaim(
  admin: AdminClient,
  params: {
    phoneDigits: string;
    benefitType: BenefitType;
    benefitId: string;
    claimedBy: string;
  },
): Promise<'inserted' | 'exists'> {
  const { error } = await admin.from('benefit_identity_claims').insert({
    phone_digits: params.phoneDigits,
    benefit_type: params.benefitType,
    benefit_id: params.benefitId,
    claimed_by: params.claimedBy,
  });

  if (!error) return 'inserted';
  if (error.code === '23505') return 'exists';
  throw new Error(error.message);
}

export async function releaseBenefitClaim(
  admin: AdminClient,
  params: {
    phoneDigits: string;
    benefitType: BenefitType;
    benefitId: string;
    claimedBy: string;
  },
): Promise<void> {
  await admin
    .from('benefit_identity_claims')
    .delete()
    .eq('phone_digits', params.phoneDigits)
    .eq('benefit_type', params.benefitType)
    .eq('benefit_id', params.benefitId)
    .eq('claimed_by', params.claimedBy);
}

export async function listClaimedCouponIds(
  admin: AdminClient,
  phoneDigits: string,
  couponIds: string[],
): Promise<Set<string>> {
  const claimed = new Set<string>();
  if (couponIds.length === 0) return claimed;

  const { data } = await admin
    .from('benefit_identity_claims')
    .select('benefit_id')
    .eq('phone_digits', phoneDigits)
    .eq('benefit_type', BENEFIT_TYPE_COUPON)
    .in('benefit_id', couponIds);

  for (const row of (data ?? []) as { benefit_id: string }[]) {
    claimed.add(row.benefit_id);
  }
  return claimed;
}

/** Snapshot current referral/coupon usage onto the phone before account delete. */
export async function persistBenefitClaimsForUser(
  admin: AdminClient,
  userId: string,
  phoneHint?: string | null,
): Promise<void> {
  const phoneDigits =
    normalizePhoneDigits(phoneHint) ?? (await resolveUserPhoneDigits(admin, userId));
  if (!phoneDigits) return;

  const rows: Array<{
    phone_digits: string;
    benefit_type: BenefitType;
    benefit_id: string;
    claimed_by: string;
  }> = [];

  const { data: attribution } = await admin
    .from('referral_attributions')
    .select('id')
    .eq('referee_id', userId)
    .limit(1)
    .maybeSingle();

  if (attribution) {
    rows.push({
      phone_digits: phoneDigits,
      benefit_type: BENEFIT_TYPE_REFERRAL,
      benefit_id: REFERRAL_WELCOME_BENEFIT_ID,
      claimed_by: userId,
    });
  }

  const { data: redemptions } = await admin
    .from('coupon_redemptions')
    .select('coupon_id')
    .eq('customer_id', userId);

  for (const row of (redemptions ?? []) as { coupon_id: string }[]) {
    rows.push({
      phone_digits: phoneDigits,
      benefit_type: BENEFIT_TYPE_COUPON,
      benefit_id: row.coupon_id,
      claimed_by: userId,
    });
  }

  if (rows.length === 0) return;

  const { error } = await admin.from('benefit_identity_claims').upsert(rows, {
    onConflict: 'phone_digits,benefit_type,benefit_id',
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}
