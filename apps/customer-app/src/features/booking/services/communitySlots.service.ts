import { supabase } from '../../../lib/supabase';
import { formatHourlySlotLabel } from './booking.service';

export type CommunityPickupSlot = {
  id: string;
  startHour: number;
  endHour: number;
  label: string;
  capacity: number;
};

/**
 * Active hourly pickup templates for a community (admin-configured).
 */
export async function getCommunityPickupSlots(
  communityId: string,
): Promise<CommunityPickupSlot[]> {
  const { data, error } = await (supabase
    .from('community_pickup_slots') as ReturnType<typeof supabase.from>)
    .select('id, start_hour, capacity, sort_order')
    .eq('community_id', communityId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('start_hour', { ascending: true });

  if (error) {
    console.warn('[Slots] community_pickup_slots fetch failed:', error.message);
    return [];
  }

  return ((data ?? []) as { id: string; start_hour: number; capacity: number }[]).map(
    (row) => ({
      id: row.id,
      startHour: row.start_hour,
      endHour: row.start_hour + 1,
      label: formatHourlySlotLabel(row.start_hour),
      capacity: row.capacity,
    }),
  );
}
