import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { supabase } from '../../../lib/supabase';
import { clearJobsCache } from './jobs.service';
import { getRiderId } from './job-utils';

export type DeliveryItem = {
  id: string;
  garmentName: string;
  quantity: number;
  unitPrice: number;
};

export async function getDeliveryItems(orderId: string): Promise<DeliveryItem[]> {
  const { data, error } = await (supabase
    .from('order_items') as ReturnType<typeof supabase.from>)
    .select('id, quantity, unit_price, service:service_id (name)')
    .eq('order_id', orderId);

  if (error) {
    console.error('[Delivery] items error:', error);
    return [];
  }

  return ((data as {
    id: string;
    quantity: number;
    unit_price: number;
    service: { name: string } | null;
  }[]) || []).map((row) => ({
    id: row.id,
    garmentName: row.service?.name || 'Garment',
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
  }));
}

export async function confirmDelivery(orderId: string): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const { error: orderError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .update({ status: 'delivered' })
    .eq('id', orderId);

  if (orderError) throw new Error(orderError.message);

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'delivered',
    note: 'Order delivered to customer',
    actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
    metadata: {},
  });

  await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('job_type', 'delivery');

  clearJobsCache();
}
