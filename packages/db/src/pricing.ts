export const DEFAULT_GARMENT_CATEGORIES = ['Men', 'Women', 'Kids', 'Others'] as const;

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
 * Tab order: All, then the saved category order.
 * Names missing from that order fall back to Men / Women / Kids / Others, then A–Z.
 * Customer rates pass includeEmptyDefaults false so empty groups stay hidden.
 */
export function listGarmentCategoryTabs(
  usedCategories: Iterable<string | null | undefined>,
  includeEmptyDefaults: boolean,
  savedOrder?: Iterable<string | null | undefined> | null,
): string[] {
  const present = new Set<string>();
  for (const raw of usedCategories) {
    present.add(normalizeGarmentCategory(raw));
  }

  const visible = new Set<string>(present);
  if (includeEmptyDefaults) {
    for (const category of DEFAULT_GARMENT_CATEGORIES) visible.add(category);
  }

  const ranked: string[] = [];
  const seen = new Set<string>();
  const push = (category: string) => {
    if (!visible.has(category) || seen.has(category)) return;
    ranked.push(category);
    seen.add(category);
  };

  if (savedOrder) {
    for (const raw of savedOrder) push(normalizeGarmentCategory(raw));
  }
  for (const category of DEFAULT_GARMENT_CATEGORIES) push(category);

  const extras = Array.from(visible)
    .filter((category) => !seen.has(category))
    .sort((a, b) => a.localeCompare(b));

  return ['All', ...ranked, ...extras];
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
  discount_price?: number | null;
  scope: PricingScope;
  city: string | null;
  community_id: string | null;
  user_id: string | null;
  effective_from: string;
};

export type ResolvedUnitPrice = {
  /** Amount charged. Discount price when it is greater than 0 and below the base price. */
  unitPrice: number;
  /** Base price when a discount applies, otherwise null. */
  listPrice: number | null;
};

function quoteFromRule(rule: Pick<PricingRuleCandidate, 'base_price' | 'discount_price'>): ResolvedUnitPrice {
  const base = Number(rule.base_price);
  const raw = rule.discount_price;
  const discount = raw == null ? null : Number(raw);
  const hasDiscount =
    discount != null && Number.isFinite(discount) && discount > 0 && discount < base;
  return {
    unitPrice: hasDiscount ? discount : base,
    listPrice: hasDiscount ? base : null,
  };
}

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
): Map<string, ResolvedUnitPrice> {
  const best = new Map<
    string,
    { rank: number; effectiveFrom: string; quote: ResolvedUnitPrice }
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
        quote: quoteFromRule(rule),
      });
    }
  }

  const prices = new Map<string, ResolvedUnitPrice>();
  for (const [serviceId, row] of best) {
    prices.set(serviceId, row.quote);
  }
  return prices;
}
