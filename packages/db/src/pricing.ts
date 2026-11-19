export const DEFAULT_GARMENT_CATEGORIES = ['Men', 'Women', 'Kids', 'Others'] as const;

export const SERVICE_LINES = [
  { id: 'ironing', label: 'Iron' },
  { id: 'steam_ironing', label: 'Steam iron' },
  { id: 'dry_cleaning', label: 'Dry clean' },
  { id: 'laundry', label: 'Laundry' },
  { id: 'shoe_cleaning', label: 'Shoe cleaning' },
  { id: 'repair', label: 'Repair' },
] as const;

export type ServiceLineId = string;

function slugServiceLine(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titleServiceLine(id: string): string {
  return id
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Known types keep their ids. Custom types become a stable slug. Empty stays Iron. */
export function normalizeServiceLine(value: string | null | undefined): ServiceLineId {
  const slug = slugServiceLine(value ?? '');
  if (!slug) return 'ironing';
  const match = SERVICE_LINES.find(
    (line) =>
      line.id === slug ||
      slugServiceLine(line.label) === slug,
  );
  return match?.id ?? slug;
}

export function serviceLineLabel(value: string | null | undefined): string {
  const id = normalizeServiceLine(value);
  return SERVICE_LINES.find((line) => line.id === id)?.label ?? titleServiceLine(id);
}

export function formatServiceOptionLabel(
  name: string,
  garmentCategory?: string | null,
  category?: string | null,
): string {
  return `${name.trim()} · ${normalizeGarmentCategory(garmentCategory)} · ${serviceLineLabel(category)}`;
}

export function formatServiceDisplayName(
  name: string,
  category?: string | null,
): string {
  return `${name.trim()} · ${serviceLineLabel(category)}`;
}

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
 * People tabs in saved order.
 * Names missing from that order fall back to Men / Women / Kids / Others, then A–Z.
 * Pass includeEmptyDefaults false so groups with no rows stay hidden.
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

  return [...ranked, ...extras];
}

export type CatalogBrowseFields = {
  name: string;
  garmentCategory: string;
  serviceLine: string;
};

/**
 * Service types in Iron → Steam iron → Dry clean order, then custom names A–Z.
 * Pass includeEmptyDefaults true in the admin form so unused defaults stay listed.
 */
export function listServiceLineChoices(
  usedCategories: Iterable<string | null | undefined>,
  includeEmptyDefaults: boolean,
): ServiceLineId[] {
  const present = new Set<ServiceLineId>();
  for (const raw of usedCategories) {
    if ((raw ?? '').trim()) present.add(normalizeServiceLine(raw));
  }
  if (includeEmptyDefaults) {
    for (const line of SERVICE_LINES) present.add(line.id);
  }

  const ranked = SERVICE_LINES.map((line) => line.id).filter((id) => present.has(id));
  const extras = Array.from(present)
    .filter((id) => !SERVICE_LINES.some((line) => line.id === id))
    .sort((a, b) => serviceLineLabel(a).localeCompare(serviceLineLabel(b)));
  return [...ranked, ...extras];
}

/** Service types that have at least one row. */
export function listUsedServiceLines(
  categories: Iterable<string | null | undefined>,
): ServiceLineId[] {
  return listServiceLineChoices(categories, false);
}

/** Keep the chosen type and people tab when they still have rows; otherwise snap to the first. */
export function resolveCatalogBrowse<T extends CatalogBrowseFields>(
  items: readonly T[],
  selection: { serviceLine?: string | null; garmentCategory?: string | null },
  options?: {
    savedOrder?: Iterable<string | null | undefined> | null;
    includeEmptyPeople?: boolean;
  },
): {
  serviceLines: ServiceLineId[];
  serviceLine: ServiceLineId | null;
  categories: string[];
  garmentCategory: string | null;
} {
  const serviceLines = listUsedServiceLines(items.map((item) => item.serviceLine));
  const requestedLine = (selection.serviceLine ?? '').trim();
  const serviceLine =
    requestedLine && serviceLines.includes(normalizeServiceLine(requestedLine))
      ? normalizeServiceLine(requestedLine)
      : (serviceLines[0] ?? null);

  const inLine = serviceLine
    ? items.filter((item) => normalizeServiceLine(item.serviceLine) === serviceLine)
    : [];
  const categories = listGarmentCategoryTabs(
    inLine.map((item) => item.garmentCategory),
    options?.includeEmptyPeople ?? false,
    options?.savedOrder,
  );
  const requestedPeople = (selection.garmentCategory ?? '').trim();
  const garmentCategory = categories.includes(requestedPeople)
    ? requestedPeople
    : (categories[0] ?? null);

  return { serviceLines, serviceLine, categories, garmentCategory };
}

/** Both service type and people are required. Search matches the garment name only. */
export function filterCatalogItems<T extends CatalogBrowseFields>(
  items: readonly T[],
  filters: { serviceLine: string; garmentCategory: string; query?: string },
): T[] {
  const line = normalizeServiceLine(filters.serviceLine);
  const people = normalizeGarmentCategory(filters.garmentCategory);
  const needle = (filters.query ?? '').trim().toLowerCase();
  return items.filter((item) => {
    if (normalizeServiceLine(item.serviceLine) !== line) return false;
    if (normalizeGarmentCategory(item.garmentCategory) !== people) return false;
    if (needle && !item.name.trim().toLowerCase().includes(needle)) return false;
    return true;
  });
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
  estimated_days?: number | null;
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
  /** Turnaround from the winning rule. Null when the rule does not set one. */
  estimatedDays: number | null;
};

/** Whole days from 1 to 60. Anything else is treated as unset. */
export function normalizeEstimatedDays(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const days = Number(value);
  if (!Number.isFinite(days) || !Number.isInteger(days) || days < 1 || days > 60) return null;
  return days;
}

export function formatReadyIn(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

function quoteFromRule(
  rule: Pick<PricingRuleCandidate, 'base_price' | 'discount_price' | 'estimated_days'>,
): ResolvedUnitPrice {
  const base = Number(rule.base_price);
  const raw = rule.discount_price;
  const discount = raw == null ? null : Number(raw);
  const hasDiscount =
    discount != null && Number.isFinite(discount) && discount > 0 && discount < base;
  return {
    unitPrice: hasDiscount ? discount : base,
    listPrice: hasDiscount ? base : null,
    estimatedDays: normalizeEstimatedDays(rule.estimated_days),
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
