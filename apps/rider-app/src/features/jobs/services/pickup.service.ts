import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { supabase } from '../../../lib/supabase';
import { getRiderId } from './job-utils';

export type GarmentCatalogItem = {
  serviceId: string;
  name: string;
  unitPrice: number;
};

export type PickupLineItem = {
  serviceId: string;
  quantity: number;
};

export async function getGarmentCatalog(communityId: string): Promise<GarmentCatalogItem[]> {
  const { data: services, error } = await (supabase
    .from('services') as ReturnType<typeof supabase.from>)
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error || !services) {
    console.error('[Pickup] catalog error:', error);
    return [];
  }

  const { data: rules } = await (supabase
    .from('pricing_rules') as ReturnType<typeof supabase.from>)
    .select('service_id, base_price, community_id')
    .or(`community_id.eq.${communityId},community_id.is.null`)
    .order('community_id', { ascending: false });

  const priceMap = new Map<string, number>();
  for (const rule of (rules as { service_id: string; base_price: number; community_id: string | null }[]) || []) {
    if (!priceMap.has(rule.service_id)) {
      priceMap.set(rule.service_id, Number(rule.base_price));
    }
  }

  return (services as { id: string; name: string }[]).map((service) => ({
    serviceId: service.id,
    name: service.name,
    unitPrice: priceMap.get(service.id) ?? 0,
  }));
}

export async function confirmPickup(
  orderId: string,
  communityId: string,
  items: PickupLineItem[],
): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const catalog = await getGarmentCatalog(communityId);
  const priceByService = Object.fromEntries(catalog.map((c) => [c.serviceId, c.unitPrice]));

  const lineItems = items
    .filter((item) => item.quantity > 0)
    .map((item) => ({
      order_id: orderId,
      service_id: item.serviceId,
      quantity: item.quantity,
      unit_price: priceByService[item.serviceId] ?? 0,
    }));

  if (lineItems.length === 0) {
    throw new Error('Add at least one garment');
  }

  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price),
    0,
  );

  await (supabase.from('order_items') as ReturnType<typeof supabase.from>)
    .delete()
    .eq('order_id', orderId);

  const { error: itemsError } = await (supabase
    .from('order_items') as ReturnType<typeof supabase.from>)
    .insert(lineItems);

  if (itemsError) throw new Error(itemsError.message);

  const { error: orderError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .update({
      status: 'picked_up',
      subtotal,
      total_amount: subtotal,
    })
    .eq('id', orderId);

  if (orderError) throw new Error(orderError.message);

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'picked_up',
    note: 'Clothes picked up by rider',
    actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
    metadata: { garment_count: lineItems.reduce((s, i) => s + i.quantity, 0) },
  });

  await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('job_type', 'pickup');

  const { data: existingDelivery } = await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('order_id', orderId)
    .eq('job_type', 'delivery')
    .maybeSingle();

  if (!existingDelivery) {
    const { data: order } = await (supabase
      .from('orders') as ReturnType<typeof supabase.from>)
      .select('delivery_slot:delivery_slot_id (window_start, window_end)')
      .eq('id', orderId)
      .single();

    const slot = (order as {
      delivery_slot: { window_start: string; window_end: string } | null;
    } | null)?.delivery_slot;

    await (supabase.from('rider_jobs') as ReturnType<typeof supabase.from>).insert({
      order_id: orderId,
      rider_id: riderId,
      job_type: 'delivery',
      status: 'assigned',
      scheduled_start: slot?.window_start ?? null,
      scheduled_end: slot?.window_end ?? null,
    });
  }
}
