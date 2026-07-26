import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
 * Active services with community-aware unit prices (community override preferred).
 */
export async function getGarmentCatalog(
  communityId: string,
): Promise<GarmentCatalogItem[]> {
  const { data: services, error } = await (supabase
    .from('services') as ReturnType<typeof supabase.from>)
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error || !services) {
    console.error('[Catalog] services error:', error);
    return [];
  }

  const { data: rules } = await (supabase
    .from('pricing_rules') as ReturnType<typeof supabase.from>)
    .select('service_id, base_price, community_id')
    .or(`community_id.eq.${communityId},community_id.is.null`)
    .order('community_id', { ascending: false });

  const priceMap = new Map<string, number>();
  for (const rule of (rules as {
    service_id: string;
    base_price: number;
    community_id: string | null;
  }[]) || []) {
    if (!priceMap.has(rule.service_id)) {
      priceMap.set(rule.service_id, Number(rule.base_price));
    }
  }

  return (services as { id: string; name: string }[]).map((service) => ({
    serviceId: service.id,
    name: service.name,
    unitPrice: priceMap.get(service.id) ?? 0,
    icon: garmentIcon(service.name),
  }));
}
