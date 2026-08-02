import type { TypedSupabaseClient } from '@ironcloud/db';

/**
 * Ensure an open delivery rider_job exists for the order.
 * Prefers the pickup rider; falls back to an active community rider.
 */
export async function ensureDeliveryRiderJob(
  supabase: TypedSupabaseClient,
  orderId: string,
): Promise<{ riderId: string; alreadyExisted: boolean }> {
  const { data: existing } = await supabase
    .from('rider_jobs')
    .select('id, rider_id')
    .eq('order_id', orderId)
    .eq('job_type', 'delivery')
    .in('status', ['assigned', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.rider_id) {
    return { riderId: existing.rider_id, alreadyExisted: true };
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(
      `
      community_id,
      delivery_slot:delivery_slot_id (window_start, window_end)
    `,
    )
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message || 'Order not found');
  }

  const { data: pickupJob } = await supabase
    .from('rider_jobs')
    .select('rider_id')
    .eq('order_id', orderId)
    .eq('job_type', 'pickup')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let riderId = pickupJob?.rider_id ?? null;

  if (!riderId && order.community_id) {
    riderId = await resolveCommunityRiderId(supabase, order.community_id);
  }

  if (!riderId) {
    throw new Error(
      'No rider available to assign for delivery. Assign a rider to this community first.',
    );
  }

  const rawSlot = order.delivery_slot as
    | { window_start: string; window_end: string }
    | { window_start: string; window_end: string }[]
    | null;
  const slotRow = Array.isArray(rawSlot) ? rawSlot[0] ?? null : rawSlot;

  const { error: insertError } = await supabase.from('rider_jobs').insert({
    order_id: orderId,
    rider_id: riderId,
    job_type: 'delivery',
    status: 'assigned',
    scheduled_start: slotRow?.window_start ?? null,
    scheduled_end: slotRow?.window_end ?? null,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return { riderId, alreadyExisted: false };
}

async function resolveCommunityRiderId(
  supabase: TypedSupabaseClient,
  communityId: string,
): Promise<string | null> {
  const { data: links } = await supabase
    .from('rider_communities')
    .select('rider_id')
    .eq('community_id', communityId);

  const riderIds = (links ?? []).map((row) => row.rider_id as string);
  if (riderIds.length === 0) return null;

  const { data: riderRows } = await supabase
    .from('riders')
    .select('id, is_active')
    .in('id', riderIds);

  const activeIds = new Set(
    (riderRows ?? [])
      .filter((row) => row.is_active)
      .map((row) => row.id as string),
  );

  const sorted = [...riderIds].sort();
  return sorted.find((id) => activeIds.has(id)) ?? sorted[0] ?? null;
}
