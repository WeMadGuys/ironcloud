import { supabase } from '../../../lib/supabase';

export type Community = {
  id: string;
  name: string;
  city: string;
  status: string;
  blocksEnabled: boolean;
};

export type CommunityBlock = {
  id: string;
  name: string;
};

export type CommunityFlat = {
  id: string;
  flatNumber: string;
};

function mapCommunity(row: {
  id: string;
  name: string;
  city: string;
  status: string;
  blocks_enabled?: boolean | null;
}): Community {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    status: row.status,
    blocksEnabled: Boolean(row.blocks_enabled),
  };
}

/**
 * Search communities by name
 */
export async function searchCommunities(query: string): Promise<Community[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const { data, error } = await (supabase
    .from('communities') as ReturnType<typeof supabase.from>)
    .select('id, name, city, status, blocks_enabled')
    .eq('status', 'active')
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching communities:', error);
    return [];
  }

  return (data || []).map(mapCommunity);
}

/**
 * Get a single community by ID
 */
export async function getCommunityById(id: string): Promise<Community | null> {
  const { data, error } = await (supabase
    .from('communities') as ReturnType<typeof supabase.from>)
    .select('id, name, city, status, blocks_enabled')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching community:', error);
    return null;
  }

  return data ? mapCommunity(data) : null;
}

/**
 * Get all active communities (for initial list)
 */
export async function getActiveCommunities(): Promise<Community[]> {
  const { data, error } = await (supabase
    .from('communities') as ReturnType<typeof supabase.from>)
    .select('id, name, city, status, blocks_enabled')
    .eq('status', 'active')
    .order('name')
    .limit(50);

  if (error) {
    console.error('Error fetching communities:', error);
    return [];
  }

  return (data || []).map(mapCommunity);
}

export async function getCommunityBlocks(
  communityId: string,
): Promise<CommunityBlock[]> {
  const { data, error } = await (supabase
    .from('community_blocks') as ReturnType<typeof supabase.from>)
    .select('id, name')
    .eq('community_id', communityId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching community blocks:', error);
    return [];
  }

  return (data || []).map((row: { id: string; name: string }) => ({
    id: row.id,
    name: row.name,
  }));
}

export async function getBlockFlats(blockId: string): Promise<CommunityFlat[]> {
  const { data, error } = await (supabase
    .from('community_flats') as ReturnType<typeof supabase.from>)
    .select('id, flat_number')
    .eq('block_id', blockId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('flat_number', { ascending: true });

  if (error) {
    console.error('Error fetching block flats:', error);
    return [];
  }

  return (data || []).map((row: { id: string; flat_number: string }) => ({
    id: row.id,
    flatNumber: row.flat_number,
  }));
}
