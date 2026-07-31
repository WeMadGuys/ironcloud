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
  cities: string[] | null;
  userIds: string[] | null;
};

export type BannerAudienceContext = {
  userId: string | null;
  communityId: string | null;
  city: string | null;
};

type BannerRow = {
  id: string;
  title: string;
  image_url: string | null;
  link: string | null;
  position: string | null;
  max_impressions: number | null;
  community_ids: string[] | null;
  cities: string[] | null;
  user_ids: string[] | null;
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
    cities: row.cities,
    userIds: row.user_ids,
  };
}

/**
 * Eligibility:
 * - If user_ids is non-empty → only those users (community/city ignored).
 * - Else community + city must both pass when set (coupon-style).
 * - All empty → everyone.
 */
export function matchesBannerAudience(
  banner: PromoBanner,
  ctx: BannerAudienceContext,
): boolean {
  const userIds = banner.userIds ?? [];
  if (userIds.length > 0) {
    return Boolean(ctx.userId && userIds.includes(ctx.userId));
  }

  const communities = banner.communityIds ?? [];
  if (communities.length > 0) {
    if (!ctx.communityId || !communities.includes(ctx.communityId)) return false;
  }

  const cities = (banner.cities ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (cities.length > 0) {
    const city = ctx.city?.trim().toLowerCase() ?? '';
    if (!city || !cities.includes(city)) return false;
  }

  return true;
}

/**
 * Active home banners for the signed-in customer.
 * Date/active filters are enforced by RLS; audience targeting is client-side.
 */
export async function fetchActiveHomeBanners(options?: {
  force?: boolean;
}): Promise<PromoBanner[]> {
  return bannersCache.getOrFetch(async () => {
    const { data, error } = await (supabase
      .from('banners') as ReturnType<typeof supabase.from>)
      .select(
        'id, title, image_url, link, position, max_impressions, community_ids, cities, user_ids',
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
  return pickEligibleHomeBanner(
    { userId: null, communityId, city: null },
    options,
  );
}

export async function pickEligibleHomeBanner(
  ctx: BannerAudienceContext,
  options?: { force?: boolean },
): Promise<PromoBanner | null> {
  const banners = await fetchActiveHomeBanners(options);
  return banners.find((b) => matchesBannerAudience(b, ctx)) ?? null;
}
