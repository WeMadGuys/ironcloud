import { formatServiceDisplayName } from '@ironcloud/db';

import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { countActiveOrderBoxes } from './box.service';
import { clearJobsCache } from './jobs.service';
import { getRiderId } from './job-utils';
import { deletePickupPhotos } from './pickup-photos.service';

export type DeliveryItem = {
  id: string;
  garmentName: string;
  quantity: number;
  unitPrice: number;
};

export async function getDeliveryItems(orderId: string): Promise<DeliveryItem[]> {
  const { data, error } = await (supabase
    .from('order_items') as ReturnType<typeof supabase.from>)
    .select('id, quantity, unit_price, service:service_id (name, category)')
    .eq('order_id', orderId);

  if (error) {
    console.error('[Delivery] items error:', error);
    return [];
  }

  return ((data as {
    id: string;
    quantity: number;
    unit_price: number;
    service: { name: string; category?: string | null } | null;
  }[]) || []).map((row) => ({
    id: row.id,
    garmentName: formatServiceDisplayName(
      row.service?.name || 'Garment',
      row.service?.category,
    ),
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
  }));
}

export class InsufficientDeliveryWalletError extends Error {
  readonly balance: number;
  readonly amount: number;

  constructor(amount: number, balance: number) {
    super('Ask the customer to add money to their wallet before handing over the clothes.');
    this.name = 'InsufficientDeliveryWalletError';
    this.amount = amount;
    this.balance = balance;
  }
}

export function isInsufficientDeliveryWalletError(
  error: unknown,
): error is InsufficientDeliveryWalletError {
  return (
    error instanceof InsufficientDeliveryWalletError ||
    (typeof error === 'object' &&
      error != null &&
      (error as { name?: string }).name === 'InsufficientDeliveryWalletError')
  );
}

/** Charge the wallet. Delivery is not completed when this throws. */
async function debitWalletForDelivery(orderId: string): Promise<void> {
  if (AUTH_PROVIDER === 'mock') {
    const { error } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ payment_status: 'paid' })
      .eq('id', orderId);
    if (error) throw new Error(error.message);
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Session expired. Please sign in again and retry.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/booking/confirm-delivery-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    insufficient?: boolean;
    amount?: number;
    balance?: number;
    error?: string;
  } | null;

  if (body?.insufficient || response.status === 402) {
    throw new InsufficientDeliveryWalletError(
      Number(body?.amount ?? 0),
      Number(body?.balance ?? 0),
    );
  }

  if (!response.ok || body?.success === false) {
    throw new Error(body?.error || 'Could not charge the customer wallet.');
  }
}

export async function confirmDelivery(orderId: string): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const activeBoxes = await countActiveOrderBoxes(orderId);
  if (activeBoxes > 0) {
    throw new Error(
      `Release all boxes before completing delivery (${activeBoxes} still assigned).`,
    );
  }

  await debitWalletForDelivery(orderId);
  await deletePickupPhotos(orderId);

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
