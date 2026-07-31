import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  pickBestUnitPrices,
  type PricingRuleCandidate,
  type PricingScope,
} from '@ironcloud/db';

import { supabase } from '../../../lib/supabase';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type GarmentCatalogItem = {
  serviceId: string;
  name: string;
  unitPrice: number;
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

/**
 * Active services with audience-aware unit prices.
 * Precedence: user > community > city > all (platform default).
 */
export async function getGarmentCatalog(opts: {
  communityId: string;
  userId?: string | null;
  city?: string | null;
}): Promise<GarmentCatalogItem[]> {
  const { communityId, userId, city } = opts;

  const { data: services, error } = await (supabase
    .from('services') as ReturnType<typeof supabase.from>)
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error || !services) {
    console.error('[Catalog] services error:', error);
    return [];
  }

  const { data: rules, error: rulesError } = await (supabase
    .from('pricing_rules') as ReturnType<typeof supabase.from>)
    .select(
      'service_id, base_price, scope, city, community_id, user_id, effective_from',
    );

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

  return (services as { id: string; name: string }[]).map((service) => ({
    serviceId: service.id,
    name: service.name,
    unitPrice: priceMap.get(service.id) ?? 0,
    icon: garmentIcon(service.name),
  }));
}
