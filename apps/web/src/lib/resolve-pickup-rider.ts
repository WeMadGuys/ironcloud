import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient<any>;

export type ResolvedPickupRider = {
  riderId: string;
  riderName: string;
  riderPhone: string | null;
};

/**
 * Pick a pickup rider for a community (service-role client).
 * Prefers an active assigned rider; otherwise first mapping (stable by id).
 */
export async function resolvePickupRiderForCommunity(
  admin: AdminClient,
  communityId: string,
): Promise<ResolvedPickupRider | { error: string; status: number }> {
  const { data: links, error: linksError } = await admin
    .from('rider_communities')
    .select('rider_id')
    .eq('community_id', communityId);

  if (linksError) {
    return { error: linksError.message, status: 500 };
  }

  const riderIds = (links ?? []).map((row: { rider_id: string }) => row.rider_id);
  if (riderIds.length === 0) {
    return {
      error: 'No rider is assigned to this community. Ask ops to assign one.',
      status: 404,
    };
  }

  const { data: riderRows, error: ridersError } = await admin
    .from('riders')
    .select('id, is_active')
    .in('id', riderIds);

  if (ridersError) {
    return { error: ridersError.message, status: 500 };
  }

  const activeIds = new Set(
    (riderRows ?? [])
      .filter((row: { id: string; is_active: boolean | null }) => row.is_active)
      .map((row: { id: string }) => row.id),
  );

  const sortedIds = [...riderIds].sort();
  const riderId = sortedIds.find((id) => activeIds.has(id)) ?? sortedIds[0] ?? null;

  if (!riderId) {
    return {
      error: 'No rider is assigned to this community. Ask ops to assign one.',
      status: 404,
    };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('full_name, phone')
    .eq('id', riderId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message, status: 500 };
  }

  return {
    riderId,
    riderName: profile?.full_name?.trim() || 'Pickup Partner',
    riderPhone: profile?.phone ?? null,
  };
}
