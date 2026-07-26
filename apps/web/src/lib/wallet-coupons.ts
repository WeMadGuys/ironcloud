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

/** Static offer copy for listing (no amount needed). */
export function offerLabel(coupon: WalletCouponRow): string {
  const min = coupon.min_amount != null ? Number(coupon.min_amount) : null;

  if (coupon.discount_type === 'flat') {
    const bonus = Number(coupon.discount_value) || 0;
    if (min != null && min > 0) {
      const total = Math.round((min + bonus) * 100) / 100;
      return `Recharge ₹${min} get ₹${total}`;
    }
    return `Get ₹${bonus} extra`;
  }

  const pct = Number(coupon.discount_value);
  const max =
    coupon.max_discount != null ? ` (max ₹${Number(coupon.max_discount)})` : '';
  if (min != null && min > 0) {
    return `Recharge ₹${min}+ · Get ${pct}% extra${max}`;
  }
  return `Get ${pct}% extra${max}`;
}

export function bonusLabel(coupon: WalletCouponRow): string {
  return offerLabel(coupon);
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
  if (coupon.min_amount == null) return amount > 0;
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

/** Visible in Add Money list (ignore amount). */
export function isListedWalletCoupon(
  coupon: WalletCouponRow,
  ctx: CustomerTargetContext,
  alreadyRedeemed: boolean,
): boolean {
  if (alreadyRedeemed) return false;
  if (!matchesWalletTopupScope(coupon)) return false;
  if (!isCouponGenerallyValid(coupon)) return false;
  if (!matchesTarget(coupon, ctx)) return false;
  return true;
}

export function isEligibleWalletCoupon(
  coupon: WalletCouponRow,
  amount: number,
  ctx: CustomerTargetContext,
  alreadyRedeemed: boolean,
): boolean {
  if (!isListedWalletCoupon(coupon, ctx, alreadyRedeemed)) return false;
  if (!matchesAmount(coupon, amount)) return false;
  return true;
}
