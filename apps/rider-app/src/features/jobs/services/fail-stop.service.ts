import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { getOrderBoxes, releaseBoxFromOrder } from './box.service';
import { clearJobsCache } from './jobs.service';
import { getRiderId } from './job-utils';

export const PICKUP_FAILURE_REASONS = [
  'Unable to reach customer',
  'No answer on call',
  'No answer at the door',
  'Customer not at home',
  'Clothes not ready',
  'Customer asked to reschedule',
  'Could not find the flat',
  'Society or security denied entry',
  'Customer refused the pickup',
] as const;

export const DELIVERY_FAILURE_REASONS = [
  'No answer on call',
  'No answer at the door',
  'Customer not at home',
  'Customer asked to reschedule',
  'Could not find the flat',
  'Society or security denied entry',
  'Customer refused the delivery',
] as const;

async function notifyCustomer(orderId: string, jobType: 'pickup' | 'delivery'): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) return;

  const response = await fetch(`${getApiBaseUrl()}/api/rider/notify-stop-failed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderId, jobType }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    console.warn('[Stop failed] customer notice:', body?.error || response.status);
  }
}

/**
 * Records a door attempt that could not be completed.
 * The order stays open. Pickup boxes are released so they can be used again.
 */
export async function failRiderStop(
  orderId: string,
  jobType: 'pickup' | 'delivery',
  reason: string,
): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('Choose a reason');

  if (jobType === 'pickup') {
    const boxes = await getOrderBoxes(orderId, true);
    for (const box of boxes) {
      if (box.boxCode) await releaseBoxFromOrder(orderId, box.boxCode);
    }
  }

  const { data: order } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
    .select('status')
    .eq('id', orderId)
    .maybeSingle();

  const { data: updated, error } = await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .update({
      status: 'failed',
      failure_reason: trimmed,
      completed_at: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('job_type', jobType)
    .eq('rider_id', riderId)
    .select('id');

  if (error) throw new Error(error.message);
  if (!updated || (updated as { id: string }[]).length === 0) {
    throw new Error('This stop is no longer assigned to you.');
  }

  const orderStatus =
    (order as { status: string } | null)?.status ||
    (jobType === 'pickup' ? 'pickup_assigned' : 'out_for_delivery');

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: orderStatus,
    note: `${jobType === 'pickup' ? 'Pickup' : 'Delivery'} attempt failed: ${trimmed}`,
    actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
    metadata: { kind: 'stop_failed', jobType, reason: trimmed },
  });

  clearJobsCache();

  try {
    await notifyCustomer(orderId, jobType);
  } catch (err) {
    console.warn('[Stop failed] customer notice:', err);
  }
}

/**
 * Customer called back after a failed pickup. Reopen the same job so the rider
 * can collect and confirm pickup.
 */
export async function resumeFailedPickup(orderId: string): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const { data: updated, error } = await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .update({
      status: 'assigned',
      failure_reason: null,
      completed_at: null,
    })
    .eq('order_id', orderId)
    .eq('job_type', 'pickup')
    .eq('rider_id', riderId)
    .eq('status', 'failed')
    .select('id');

  if (error) throw new Error(error.message);
  if (!updated || (updated as { id: string }[]).length === 0) {
    throw new Error('This pickup can no longer be collected.');
  }

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'pickup_assigned',
    note: 'Pickup resumed after a failed attempt',
    actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
    metadata: { kind: 'stop_resumed', jobType: 'pickup' },
  });

  clearJobsCache();
}
