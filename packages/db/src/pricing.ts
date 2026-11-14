export const DEFAULT_GARMENT_CATEGORIES = ['Men', 'Women', 'Kids', 'Others'] as const;

const DEFAULT_GARMENT_CATEGORY_SET = new Set<string>(DEFAULT_GARMENT_CATEGORIES);

/** Empty or unknown values land in Others. Default names match regardless of case. */
export function normalizeGarmentCategory(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'Others';
  const match = DEFAULT_GARMENT_CATEGORIES.find(
    (category) => category.toLowerCase() === trimmed.toLowerCase(),
  );
  return match ?? trimmed;
}

/**
 * Tab order: All, then Men / Women / Kids / Others, then any custom names A–Z.
 * Customer rates pass includeEmptyDefaults false so empty groups stay hidden.
 */
export function listGarmentCategoryTabs(
  usedCategories: Iterable<string | null | undefined>,
  includeEmptyDefaults: boolean,
): string[] {
  const present = new Set<string>();
  for (const raw of usedCategories) {
    present.add(normalizeGarmentCategory(raw));
  }

  const defaults = includeEmptyDefaults
    ? [...DEFAULT_GARMENT_CATEGORIES]
    : DEFAULT_GARMENT_CATEGORIES.filter((category) => present.has(category));

  const extras = Array.from(present)
    .filter((category) => !DEFAULT_GARMENT_CATEGORY_SET.has(category))
    .sort((a, b) => a.localeCompare(b));

  return ['All', ...defaults, ...extras];
}

export type PricingScope = 'all' | 'city' | 'community' | 'user';

export const PRICING_SCOPE_RANK: Record<PricingScope, number> = {
  user: 3,
  community: 2,
  city: 1,
  all: 0,
};

export type PricingRuleCandidate = {
  service_id: string;
  base_price: number;
  scope: PricingScope;
  city: string | null;
  community_id: string | null;
  user_id: string | null;
  effective_from: string;
};

export type PricingAudienceContext = {
  userId?: string | null;
  communityId?: string | null;
  city?: string | null;
};

function normalizeCity(city: string | null | undefined): string {
  return (city ?? '').trim().toLowerCase();
}

/** Whether a rule matches the customer's audience context. */
export function pricingRuleMatchesAudience(
  rule: PricingRuleCandidate,
  ctx: PricingAudienceContext,
): boolean {
  switch (rule.scope) {
    case 'user':
      return Boolean(ctx.userId) && rule.user_id === ctx.userId;
    case 'community':
      return Boolean(ctx.communityId) && rule.community_id === ctx.communityId;
    case 'city':
      return (
        Boolean(normalizeCity(ctx.city)) &&
        normalizeCity(rule.city) === normalizeCity(ctx.city)
      );
    case 'all':
      return true;
    default:
      return false;
  }
}

/**
 * Per service_id, pick the most granular matching rule
 * (user > community > city > all). Ties: newest effective_from.
 */
export function pickBestUnitPrices(
  rules: PricingRuleCandidate[],
  ctx: PricingAudienceContext,
): Map<string, number> {
  const best = new Map<
    string,
    { rank: number; effectiveFrom: string; price: number }
  >();

  for (const rule of rules) {
    if (!pricingRuleMatchesAudience(rule, ctx)) continue;

    const rank = PRICING_SCOPE_RANK[rule.scope] ?? 0;
    const effectiveFrom = rule.effective_from ?? '';
    const existing = best.get(rule.service_id);

    if (
      !existing ||
      rank > existing.rank ||
      (rank === existing.rank && effectiveFrom > existing.effectiveFrom)
    ) {
      best.set(rule.service_id, {
        rank,
        effectiveFrom,
        price: Number(rule.base_price),
      });
    }
  }

  const prices = new Map<string, number>();
  for (const [serviceId, row] of best) {
    prices.set(serviceId, row.price);
  }
  return prices;
}
