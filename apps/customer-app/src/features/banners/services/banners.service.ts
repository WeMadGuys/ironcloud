import { supabase } from '../../../lib/supabase';
import { createTtlCache } from '../../../lib/ttl-cache';

const BANNERS_CACHE_TTL_MS = 60_000;

export type PromoBanner = {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
  position: string;
  maxImpressions: number;
  communityIds: string[] | null;
};

type BannerRow = {
  id: string;
  title: string;
  image_url: string | null;
  link: string | null;
  position: string | null;
  max_impressions: number | null;
  community_ids: string[] | null;
};

const bannersCache = createTtlCache<PromoBanner[]>(BANNERS_CACHE_TTL_MS);

function mapRow(row: BannerRow): PromoBanner | null {
  if (!row.image_url?.trim()) return null;
  return {
    id: row.id,
    title: row.title,
    imageUrl: row.image_url.trim(),
    link: row.link?.trim() || null,
    position: row.position ?? 'home',
    maxImpressions: Math.max(1, row.max_impressions ?? 1),
    communityIds: row.community_ids,
  };
}

function matchesCommunity(banner: PromoBanner, communityId: string | null): boolean {
  if (!banner.communityIds || banner.communityIds.length === 0) return true;
  if (!communityId) return false;
  return banner.communityIds.includes(communityId);
}

/**
 * Active home banners for the signed-in customer.
 * Date/active filters are enforced by RLS; community targeting is client-side.
 */
export async function fetchActiveHomeBanners(options?: {
  force?: boolean;
}): Promise<PromoBanner[]> {
  return bannersCache.getOrFetch(async () => {
    const { data, error } = await (supabase
      .from('banners') as ReturnType<typeof supabase.from>)
      .select(
        'id, title, image_url, link, position, max_impressions, community_ids',
      )
      .eq('position', 'home')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching banners:', error);
      return [];
    }

    return ((data as BannerRow[] | null) ?? [])
      .map(mapRow)
      .filter((b): b is PromoBanner => b != null);
  }, options?.force);
}

export function clearBannersCache(): void {
  bannersCache.clear();
}

export async function pickBannerForCommunity(
  communityId: string | null,
  options?: { force?: boolean },
): Promise<PromoBanner | null> {
  const banners = await fetchActiveHomeBanners(options);
  return banners.find((b) => matchesCommunity(b, communityId)) ?? null;
}
