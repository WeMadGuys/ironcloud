import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  normalizeGarmentCategory,
  normalizeServiceLine,
  pickBestUnitPrices,
  type PricingRuleCandidate,
  type PricingScope,
} from '@ironcloud/db';

import { supabase } from '../../../lib/supabase';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type GarmentCatalogItem = {
  serviceId: string;
  name: string;
  unit: string;
  unitPrice: number;
  /** Base price when a discount applies. Null means unitPrice is the only rate. */
  listPrice: number | null;
  /** Turnaround from the winning price rule. Null hides the estimate. */
  estimatedDays: number | null;
  garmentCategory: string;
  serviceLine: string;
  icon: IconName;
};

const PRIMARY_ORDER = [
  'shirts',
  'tshirts',
  'pants',
  'sarees',
  'bedsheets',
  'blazers',
] as const;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function primaryRank(name: string): number {
  const n = normalizeName(name);
  if (n.includes('tshirt') || n === 'tees' || n === 'tee') return 1;
  if (n.includes('shirt') && !n.includes('tshirt')) return 0;
  if (n.includes('pant') || n.includes('trouser')) return 2;
  if (n.includes('saree') || n.includes('sari')) return 3;
  if (n.includes('bedsheet') || (n.includes('sheet') && !n.includes('tshirt'))) return 4;
  if (n.includes('blazer') || n.includes('coat') || n.includes('suit')) return 5;
  return -1;
}

export function isPrimaryCategory(name: string): boolean {
  return primaryRank(name) >= 0;
}

export function garmentIcon(name: string): IconName {
  const n = normalizeName(name);
  if (n.includes('tshirt') || n === 'tees') return 'tshirt-crew-outline';
  if (n.includes('shirt')) return 'hanger';
  if (n.includes('pant') || n.includes('trouser')) return 'human-male-height';
  if (n.includes('saree') || n.includes('sari')) return 'human-female';
  if (n.includes('bedsheet') || n.includes('sheet')) return 'bed-outline';
  if (n.includes('blazer') || n.includes('coat') || n.includes('suit')) return 'tie';
  return 'hanger';
}

export function splitCatalog(items: GarmentCatalogItem[]): {
  primary: GarmentCatalogItem[];
  more: GarmentCatalogItem[];
} {
  const primarySlots: (GarmentCatalogItem | null)[] = PRIMARY_ORDER.map(() => null);
  const more: GarmentCatalogItem[] = [];

  for (const item of items) {
    const rank = primaryRank(item.name);
    if (rank >= 0 && !primarySlots[rank]) {
      primarySlots[rank] = item;
    } else if (rank >= 0 && primarySlots[rank]) {
      more.push(item);
    } else {
      more.push(item);
    }
  }

  return {
    primary: primarySlots.filter((item): item is GarmentCatalogItem => item != null),
    more,
  };
}

/** Saved category tab order. Empty when the table is not migrated yet. */
export async function fetchGarmentCategoryOrder(): Promise<string[]> {
  const { data, error } = await supabase
    .from('garment_categories')
    .select('name, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.warn('[Catalog] garment_categories unavailable:', error.message);
    return [];
  }

  return (data ?? []).map((row) => row.name);
}

/**
 * Active services with a real price for this customer.
 * Precedence: user > community > city > all (platform default).
 * A service with no matching price is omitted. ₹0 is not offered.
 */
export async function getGarmentCatalog(opts: {
  communityId: string;
  userId?: string | null;
  city?: string | null;
}): Promise<GarmentCatalogItem[]> {
  const { communityId, userId, city } = opts;

  const servicesQuery = () =>
    (supabase.from('services') as ReturnType<typeof supabase.from>);

  let { data: services, error } = await servicesQuery()
    .select('id, name, unit, garment_category, category, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error && /sort_order/i.test(error.message ?? '')) {
    console.warn('[Catalog] sort_order unavailable:', error.message);
    const withCategory = await servicesQuery()
      .select('id, name, unit, garment_category, category')
      .eq('is_active', true)
      .order('name');
    services = withCategory.data;
    error = withCategory.error;
  }

  // Column is added in 039_service_garment_category.sql. Until it is applied, still show rates.
  if (error && /garment_category/i.test(error.message ?? '')) {
    console.warn('[Catalog] garment_category unavailable:', error.message);
    const fallback = await servicesQuery()
      .select('id, name, unit')
      .eq('is_active', true)
      .order('name');
    services = fallback.data;
    error = fallback.error;
  }

  if (error || !services) {
    console.error('[Catalog] services error:', error);
    return [];
  }

  const rulesQuery = () =>
    (supabase.from('pricing_rules') as ReturnType<typeof supabase.from>);

  let { data: rules, error: rulesError } = await rulesQuery().select(
    'service_id, base_price, discount_price, estimated_days, scope, city, community_id, user_id, effective_from',
  );

  if (rulesError && /estimated_days/i.test(rulesError.message ?? '')) {
    console.warn('[Catalog] estimated_days unavailable:', rulesError.message);
    const fallback = await rulesQuery().select(
      'service_id, base_price, discount_price, scope, city, community_id, user_id, effective_from',
    );
    rules = fallback.data;
    rulesError = fallback.error;
  }

  if (rulesError && /discount_price/i.test(rulesError.message ?? '')) {
    console.warn('[Catalog] discount_price unavailable:', rulesError.message);
    const fallback = await rulesQuery().select(
      'service_id, base_price, scope, city, community_id, user_id, effective_from',
    );
    rules = fallback.data;
    rulesError = fallback.error;
  }

  if (rulesError) {
    console.error('[Catalog] pricing_rules error:', rulesError);
  }

  const priceMap = pickBestUnitPrices(
    ((rules as PricingRuleCandidate[] | null) ?? []).map((rule) => ({
      ...rule,
      scope: (rule.scope as PricingScope | null) ?? (rule.community_id ? 'community' : 'all'),
    })),
    { userId, communityId, city },
  );

  return (
    services as {
      id: string;
      name: string;
      unit?: string | null;
      garment_category?: string | null;
      category?: string | null;
      sort_order?: number | null;
    }[]
  )
    .slice()
    .sort((a, b) => {
      const byOrder = Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0);
      if (byOrder !== 0) return byOrder;
      const byName = a.name.localeCompare(b.name);
      if (byName !== 0) return byName;
      return normalizeServiceLine(a.category).localeCompare(
        normalizeServiceLine(b.category),
      );
    })
    .map((service) => {
      const quote = priceMap.get(service.id);
      return {
        serviceId: service.id,
        name: service.name.trim(),
        unit: service.unit?.trim() || 'piece',
        unitPrice: quote?.unitPrice ?? 0,
        listPrice: quote?.listPrice ?? null,
        estimatedDays: quote?.estimatedDays ?? null,
        garmentCategory: normalizeGarmentCategory(service.garment_category),
        serviceLine: normalizeServiceLine(service.category),
        icon: garmentIcon(service.name),
      };
    })
    .filter((item) => item.unitPrice > 0);
}
