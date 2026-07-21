import { supabase } from '../../../lib/supabase';

export type Community = {
  id: string;
  name: string;
  city: string;
  status: string;
};

/**
 * Search communities by name
 */
export async function searchCommunities(query: string): Promise<Community[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const { data, error } = await (supabase
    .from('communities') as ReturnType<typeof supabase.from>)
    .select('id, name, city, status')
    .eq('status', 'active')
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error searching communities:', error);
    return [];
  }

  return (data || []) as Community[];
}

/**
 * Get a single community by ID
 */
export async function getCommunityById(id: string): Promise<Community | null> {
  const { data, error } = await (supabase
    .from('communities') as ReturnType<typeof supabase.from>)
    .select('id, name, city, status')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching community:', error);
    return null;
  }

  return data as Community;
}

/**
 * Get all active communities (for initial list)
 */
export async function getActiveCommunities(): Promise<Community[]> {
  const { data, error } = await (supabase
    .from('communities') as ReturnType<typeof supabase.from>)
    .select('id, name, city, status')
    .eq('status', 'active')
    .order('name')
    .limit(50);

  if (error) {
    console.error('Error fetching communities:', error);
    return [];
  }

  return (data || []) as Community[];
}
