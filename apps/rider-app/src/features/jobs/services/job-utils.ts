import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { supabase } from '../../../lib/supabase';

export async function getRiderId(): Promise<string | null> {
  if (AUTH_PROVIDER === 'mock') return MOCK_RIDER_ID;

  // Prefer local session — getUser() hits the network on every call.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) return sessionData.session.user.id;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export function getDayBounds(dayOffset: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function isDateOnDay(iso: string | null | undefined, dayOffset: number): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  const { start, end } = getDayBounds(dayOffset);
  return date >= start && date < end;
}

export function getJobDayOffset(
  jobType: 'pickup' | 'delivery',
  pickupStart: string | null,
  deliveryStart: string | null,
  dayCount = 7,
): number | null {
  const iso = jobType === 'pickup' ? pickupStart : deliveryStart;
  if (!iso) return null;
  const target = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(target);
  compare.setHours(0, 0, 0, 0);
  const diff = Math.round((compare.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (diff < 0 || diff >= dayCount) return null;
  return diff;
}

export type FlatButtonState = 'collect' | 'deliver' | 'collected' | 'delivered';

export function resolveButtonState(
  jobType: 'pickup' | 'delivery',
  jobStatus: string,
  orderStatus: string,
): FlatButtonState {
  if (jobType === 'pickup') {
    if (jobStatus === 'completed' || !['booked', 'pickup_assigned', 'pickup_in_progress'].includes(orderStatus)) {
      return 'collected';
    }
    return 'collect';
  }
  if (jobStatus === 'completed' || orderStatus === 'delivered' || orderStatus === 'completed') {
    return 'delivered';
  }
  return 'deliver';
}
