import { supabase } from '../../../lib/supabase';
import { formatHourlySlotLabel } from './booking.service';

export type CommunityPickupSlot = {
  id: string;
  startHour: number;
  endHour: number;
  label: string;
  capacity: number;
};

/** Local calendar day as YYYY-MM-DD (device timezone). */
export function localDayKey(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA');
}

export function dayOffsetToLocalDateKey(dayOffset: number, now: Date = new Date()): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return localDayKey(date);
}

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

/**
 * Closed calendar dates for a community (global ∪ community-specific).
 * Returns YYYY-MM-DD strings.
 */
export async function getClosedDatesForCommunity(
  communityId: string,
): Promise<Set<string>> {
  const { data, error } = await (supabase
    .from('booking_closed_dates') as ReturnType<typeof supabase.from>)
    .select('closed_date')
    .or(`community_id.is.null,community_id.eq.${communityId}`);

  if (error) {
    console.warn('[Slots] booking_closed_dates fetch failed:', error.message);
    return new Set();
  }

  return new Set(
    ((data ?? []) as { closed_date: string }[]).map((row) => row.closed_date),
  );
}

