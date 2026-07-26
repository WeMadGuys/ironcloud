export type WalletCouponRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  community_ids: string[] | null;
  applicable_on: string[] | null;
  cities: string[] | null;
  min_amount: number | null;
};

export type CustomerTargetContext = {
  communityId: string | null;
  city: string | null;
};

export function calcWalletBonus(coupon: WalletCouponRow, amount: number): number {
  if (coupon.discount_type === 'flat') {
    return Math.max(0, Number(coupon.discount_value) || 0);
  }
  const raw = (amount * Number(coupon.discount_value)) / 100;
  const capped =
    coupon.max_discount != null ? Math.min(raw, Number(coupon.max_discount)) : raw;
  return Math.max(0, Math.round(capped * 100) / 100);
}

export function bonusLabel(coupon: WalletCouponRow): string {
  if (coupon.discount_type === 'flat') {
    return `Get ₹${Number(coupon.discount_value)} extra`;
  }
  const max =
    coupon.max_discount != null ? ` (max ₹${Number(coupon.max_discount)})` : '';
  return `Get ${Number(coupon.discount_value)}% extra${max}`;
}

export function isCouponGenerallyValid(
  coupon: WalletCouponRow,
  now = new Date(),
): boolean {
  if (coupon.valid_from && new Date(coupon.valid_from) > now) return false;
  if (coupon.valid_to && new Date(coupon.valid_to) < now) return false;
  if (
    coupon.usage_limit != null &&
    Number(coupon.used_count) >= Number(coupon.usage_limit)
  ) {
    return false;
  }
  return true;
}

export function matchesWalletTopupScope(coupon: WalletCouponRow): boolean {
  const scopes = coupon.applicable_on ?? [];
  return scopes.includes('wallet_topup');
}

export function matchesAmount(coupon: WalletCouponRow, amount: number): boolean {
  if (coupon.min_amount == null) return true;
  return amount >= Number(coupon.min_amount);
}

export function matchesTarget(
  coupon: WalletCouponRow,
  ctx: CustomerTargetContext,
): boolean {
  const communities = coupon.community_ids ?? [];
  if (communities.length > 0) {
    if (!ctx.communityId || !communities.includes(ctx.communityId)) return false;
  }

  const cities = (coupon.cities ?? []).map((c) => c.trim().toLowerCase()).filter(Boolean);
  if (cities.length > 0) {
    const city = ctx.city?.trim().toLowerCase() ?? '';
    if (!city || !cities.includes(city)) return false;
  }

  return true;
}

export function isEligibleWalletCoupon(
  coupon: WalletCouponRow,
  amount: number,
  ctx: CustomerTargetContext,
  alreadyRedeemed: boolean,
): boolean {
  if (alreadyRedeemed) return false;
  if (!matchesWalletTopupScope(coupon)) return false;
  if (!isCouponGenerallyValid(coupon)) return false;
  if (!matchesAmount(coupon, amount)) return false;
  if (!matchesTarget(coupon, ctx)) return false;
  return true;
}
