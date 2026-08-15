import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import {
  pickBestUnitPrices,
  type PricingRuleCandidate,
  type PricingScope,
} from '@ironcloud/db';
import { countActiveOrderBoxes } from './box.service';
import { clearJobsCache } from './jobs.service';
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

type EstimatedGarment = {
  service_id?: string;
  serviceId?: string;
  name?: string;
  quantity?: number;
  unit_price?: number;
  unitPrice?: number;
};

function buildPickupDiffNote(params: {
  estimatedAmount: number | null;
  finalAmount: number;
  estimatedGarments: EstimatedGarment[] | null;
  finalLines: { serviceId: string; name: string; quantity: number }[];
}): {
  note: string;
  metadata: Record<string, unknown>;
} {
  const {
    estimatedAmount,
    finalAmount,
    estimatedGarments,
    finalLines,
  } = params;

  const garmentCount = finalLines.reduce((s, l) => s + l.quantity, 0);
  const hasEstimate =
    estimatedAmount != null && Number.isFinite(estimatedAmount);

  if (!hasEstimate) {
    return {
      note: `Pickup Confirmed\n\nFinal Amount\n₹${finalAmount}`,
      metadata: {
        garment_count: garmentCount,
        final_amount: finalAmount,
      },
    };
  }

  const est = Number(estimatedAmount);
  const difference = finalAmount - est;

  if (difference === 0) {
    return {
      note: `Pickup Confirmed\n\nFinal Amount\n₹${finalAmount}`,
      metadata: {
        garment_count: garmentCount,
        estimated_amount: est,
        final_amount: finalAmount,
        difference: 0,
      },
    };
  }

  const estMap = new Map<string, { name: string; quantity: number }>();
  for (const row of estimatedGarments || []) {
    const id = row.service_id || row.serviceId;
    if (!id) continue;
    estMap.set(id, {
      name: row.name || 'Garment',
      quantity: Number(row.quantity || 0),
    });
  }

  const finalMap = new Map(
    finalLines.map((l) => [l.serviceId, { name: l.name, quantity: l.quantity }]),
  );

  const ids = new Set([...estMap.keys(), ...finalMap.keys()]);
  const reasonLines: string[] = [];

  for (const id of ids) {
    const estQty = estMap.get(id)?.quantity ?? 0;
    const finalQty = finalMap.get(id)?.quantity ?? 0;
    const name = finalMap.get(id)?.name || estMap.get(id)?.name || 'Garment';
    const delta = finalQty - estQty;
    if (delta > 0) {
      reasonLines.push(`${delta} Extra ${name} Added`);
    } else if (delta < 0) {
      reasonLines.push(`${Math.abs(delta)} ${name} Removed`);
    }
  }

  const diffLabel = difference > 0 ? `+₹${difference}` : `-₹${Math.abs(difference)}`;
  const reasonBlock =
    reasonLines.length > 0
      ? `\n\nReason:\n${reasonLines.map((line, i) => `${i + 1}. ${line}`).join('\n')}`
      : '';

  return {
    note:
      `Pickup Confirmed\n\nEstimated Amount : ₹${est}\n\nFinal Amount : ₹${finalAmount}\n\nDifference : ${diffLabel}${reasonBlock}`,
    metadata: {
      garment_count: garmentCount,
      estimated_amount: est,
      final_amount: finalAmount,
      difference,
      reason_lines: reasonLines,
    },
  };
}

async function debitWalletAfterPickup(orderId: string): Promise<void> {
  if (AUTH_PROVIDER === 'mock') {
    const { error } = await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ payment_status: 'paid' })
      .eq('id', orderId);
    if (error) {
      console.warn('[Pickup] payment_status update skipped:', error.message);
    }
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    console.warn('[Pickup] No session for wallet debit');
    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ payment_status: 'insufficient_funds' })
      .eq('id', orderId);
    return;
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/booking/confirm-pickup-payment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ orderId }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      console.error('[Pickup] wallet debit failed:', body?.error);
      await (supabase.from('orders') as ReturnType<typeof supabase.from>)
        .update({ payment_status: 'insufficient_funds' })
        .eq('id', orderId);
    }
  } catch (error) {
    console.error('[Pickup] wallet debit network error:', error);
    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ payment_status: 'insufficient_funds' })
      .eq('id', orderId);
  }
}

export class InsufficientWalletError extends Error {
  readonly balance: number;
  readonly amount: number;

  constructor(amount: number, balance: number) {
    super(
      'Ask the customer to add money to their wallet to confirm pickup.',
    );
    this.name = 'InsufficientWalletError';
    this.amount = amount;
    this.balance = balance;
    Object.setPrototypeOf(this, InsufficientWalletError.prototype);
  }
}

export function isInsufficientWalletError(
  error: unknown,
): error is InsufficientWalletError {
  return (
    error instanceof InsufficientWalletError ||
    (typeof error === 'object' &&
      error != null &&
      (error as { name?: string }).name === 'InsufficientWalletError')
  );
}

/**
 * Verify customer wallet can cover the pickup total before confirming.
 * Throws InsufficientWalletError when balance is too low.
 */
async function assertWalletCoversPickup(
  orderId: string,
  amount: number,
): Promise<void> {
  if (AUTH_PROVIDER === 'mock') return;
  if (amount <= 0) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Session expired. Please sign in again and retry.');
  }

  const response = await fetch(
    `${getApiBaseUrl()}/api/booking/check-pickup-wallet`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ orderId, amount }),
    },
  );

  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    sufficient?: boolean;
    amount?: number;
    balance?: number;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || 'Could not verify wallet balance.');
  }

  if (!body?.sufficient) {
    throw new InsufficientWalletError(
      Number(body?.amount ?? amount),
      Number(body?.balance ?? 0),
    );
  }
}

export async function getOrderPricingContext(orderId: string): Promise<{
  customerId: string | null;
  communityId: string | null;
  city: string | null;
}> {
  const { data, error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select('customer_id, community_id, communities(city)')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[Pickup] pricing context:', error.message);
    return { customerId: null, communityId: null, city: null };
  }

  const row = data as {
    customer_id: string;
    community_id: string | null;
    communities: { city: string | null } | null;
  };

  return {
    customerId: row.customer_id,
    communityId: row.community_id,
    city: row.communities?.city ?? null,
  };
}

export async function getGarmentCatalog(opts: {
  communityId: string;
  userId?: string | null;
  city?: string | null;
}): Promise<GarmentCatalogItem[]> {
  const { communityId, userId, city } = opts;

  const { data: services, error } = await (supabase
    .from('services') as ReturnType<typeof supabase.from>)
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (error || !services) {
    console.error('[Pickup] catalog error:', error);
    return [];
  }

  const { data: rules, error: rulesError } = await (supabase
    .from('pricing_rules') as ReturnType<typeof supabase.from>)
    .select(
      'service_id, base_price, scope, city, community_id, user_id, effective_from',
    );

  if (rulesError) {
    console.error('[Pickup] pricing_rules error:', rulesError);
  }

  const priceMap = pickBestUnitPrices(
    ((rules as PricingRuleCandidate[] | null) ?? []).map((rule) => ({
      ...rule,
      scope: (rule.scope as PricingScope | null) ?? (rule.community_id ? 'community' : 'all'),
    })),
    { userId, communityId, city },
  );

  return (services as { id: string; name: string }[]).map((service) => ({
    serviceId: service.id,
    name: service.name,
    unitPrice: priceMap.get(service.id) ?? 0,
  }));
}

/**
 * Prefill Collect counters from the customer's estimate (if any).
 * Safe when migration 010 is not applied yet — returns empty counts.
 */
export async function getOrderEstimatePrefill(orderId: string): Promise<{
  counts: Record<string, number>;
  estimatedAmount: number | null;
  hasEstimate: boolean;
}> {
  const { data, error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select('estimated_amount, estimated_garments')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    // Column missing (migration not run) or order not found
    if (error) {
      console.warn('[Pickup] estimate prefill unavailable:', error.message);
    }
    return { counts: {}, estimatedAmount: null, hasEstimate: false };
  }

  const row = data as {
    estimated_amount: number | null;
    estimated_garments: EstimatedGarment[] | null;
  };

  const counts: Record<string, number> = {};
  for (const item of row.estimated_garments || []) {
    const id = item.service_id || item.serviceId;
    const qty = Number(item.quantity || 0);
    if (id && qty > 0) counts[id] = qty;
  }

  const hasEstimate = Object.keys(counts).length > 0;
  return {
    counts,
    estimatedAmount:
      row.estimated_amount != null ? Number(row.estimated_amount) : null,
    hasEstimate,
  };
}

/** Prefill from confirmed order_items (after collect / edit). */
export async function getOrderItemsPrefill(orderId: string): Promise<{
  counts: Record<string, number>;
  hasItems: boolean;
}> {
  const { data, error } = await (supabase
    .from('order_items') as ReturnType<typeof supabase.from>)
    .select('service_id, quantity')
    .eq('order_id', orderId);

  if (error || !data) {
    if (error) console.warn('[Pickup] items prefill:', error.message);
    return { counts: {}, hasItems: false };
  }

  const counts: Record<string, number> = {};
  for (const row of data as { service_id: string; quantity: number }[]) {
    if (row.service_id && row.quantity > 0) {
      counts[row.service_id] = row.quantity;
    }
  }

  return { counts, hasItems: Object.keys(counts).length > 0 };
}

export async function getOrderPickupDetails(orderId: string): Promise<{
  orderNumber: string;
  status: string;
  specialInstructions: string | null;
  estimatedAmount: number | null;
  customerName: string | null;
  customerPhone: string | null;
}> {
  const { data, error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select(
      'order_number, status, special_instructions, estimated_amount, customer:customer_id (full_name, phone)',
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn('[Pickup] order details:', error.message);
    return {
      orderNumber: '',
      status: '',
      specialInstructions: null,
      estimatedAmount: null,
      customerName: null,
      customerPhone: null,
    };
  }

  const row = data as {
    order_number: string;
    status: string;
    special_instructions: string | null;
    estimated_amount: number | null;
    customer: { full_name: string | null; phone: string | null } | null;
  };

  return {
    orderNumber: row.order_number,
    status: row.status,
    specialInstructions: row.special_instructions,
    estimatedAmount:
      row.estimated_amount != null ? Number(row.estimated_amount) : null,
    customerName: row.customer?.full_name?.trim() || null,
    customerPhone: row.customer?.phone?.trim() || null,
  };
}

async function buildPickupLineItems(
  orderId: string,
  communityId: string,
  items: PickupLineItem[],
): Promise<{
  subtotal: number;
  lineItems: {
    order_id: string;
    service_id: string;
    quantity: number;
    unit_price: number;
  }[];
  nameByService: Record<string, string>;
}> {
  const pricingCtx = await getOrderPricingContext(orderId);
  const catalog = await getGarmentCatalog({
    communityId: pricingCtx.communityId || communityId,
    userId: pricingCtx.customerId,
    city: pricingCtx.city,
  });
  const priceByService = Object.fromEntries(catalog.map((c) => [c.serviceId, c.unitPrice]));
  const nameByService = Object.fromEntries(catalog.map((c) => [c.serviceId, c.name]));

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

  return { subtotal, lineItems, nameByService };
}

async function writeOrderItems(
  orderId: string,
  lineItems: {
    order_id: string;
    service_id: string;
    quantity: number;
    unit_price: number;
  }[],
): Promise<void> {
  await (supabase.from('order_items') as ReturnType<typeof supabase.from>)
    .delete()
    .eq('order_id', orderId);

  const { error: itemsError } = await (supabase
    .from('order_items') as ReturnType<typeof supabase.from>)
    .insert(lineItems);

  if (itemsError) throw new Error(itemsError.message);
}

async function replaceOrderItems(
  orderId: string,
  communityId: string,
  items: PickupLineItem[],
): Promise<{
  subtotal: number;
  lineItems: {
    order_id: string;
    service_id: string;
    quantity: number;
    unit_price: number;
  }[];
  nameByService: Record<string, string>;
}> {
  const built = await buildPickupLineItems(orderId, communityId, items);
  await writeOrderItems(orderId, built.lineItems);
  return built;
}

export async function confirmPickup(
  orderId: string,
  communityId: string,
  items: PickupLineItem[],
): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const attachedBoxes = await countActiveOrderBoxes(orderId);
  if (attachedBoxes < 1) {
    throw new Error('Attach at least one box before confirming pickup.');
  }

  const { data: orderBefore } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select('estimated_amount, estimated_garments')
    .eq('id', orderId)
    .single();

  const estimatedAmount =
    orderBefore && (orderBefore as { estimated_amount: number | null }).estimated_amount != null
      ? Number((orderBefore as { estimated_amount: number | null }).estimated_amount)
      : null;
  const estimatedGarments =
    (orderBefore as { estimated_garments: EstimatedGarment[] | null } | null)
      ?.estimated_garments ?? null;

  // Price first, then require sufficient wallet — do not mutate until funds check passes.
  const { subtotal, lineItems, nameByService } = await buildPickupLineItems(
    orderId,
    communityId,
    items,
  );
  await assertWalletCoversPickup(orderId, subtotal);

  await writeOrderItems(orderId, lineItems);

  const { error: orderError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .update({
      status: 'picked_up',
      subtotal,
      total_amount: subtotal,
    })
    .eq('id', orderId);

  if (orderError) throw new Error(orderError.message);

  const { note, metadata } = buildPickupDiffNote({
    estimatedAmount,
    finalAmount: subtotal,
    estimatedGarments,
    finalLines: lineItems.map((item) => ({
      serviceId: item.service_id,
      name: nameByService[item.service_id] || 'Garment',
      quantity: item.quantity,
    })),
  });

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'picked_up',
    note,
    actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
    metadata,
  });

  await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('job_type', 'pickup');

  const { data: orderSlots } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select('delivery_slot:delivery_slot_id (window_start, window_end)')
    .eq('id', orderId)
    .single();

  const deliverySlot = (orderSlots as {
    delivery_slot: { window_start: string; window_end: string } | null;
  } | null)?.delivery_slot;

  const { data: existingDelivery } = await (supabase
    .from('rider_jobs') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('order_id', orderId)
    .eq('job_type', 'delivery')
    .maybeSingle();

  if (!existingDelivery) {
    await (supabase.from('rider_jobs') as ReturnType<typeof supabase.from>).insert({
      order_id: orderId,
      rider_id: riderId,
      job_type: 'delivery',
      status: 'assigned',
      scheduled_start: deliverySlot?.window_start ?? null,
      scheduled_end: deliverySlot?.window_end ?? null,
    });
  }

  // Same-day (or overdue) delivery: go out for delivery immediately.
  // Next-day delivery stays picked_up until advance_orders_for_delivery_day runs.
  if (isDeliveryDayReached(deliverySlot?.window_start)) {
    await (supabase.from('orders') as ReturnType<typeof supabase.from>)
      .update({ status: 'out_for_delivery' })
      .eq('id', orderId);

    await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
      order_id: orderId,
      status: 'out_for_delivery',
      note: 'Delivery day — out for delivery',
      actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
      metadata: {
        source: 'confirm_pickup_same_day',
        rider_id: riderId,
      },
    });
  }

  await debitWalletAfterPickup(orderId);
  clearJobsCache();
}

/**
 * Correct garment counts after pickup without re-running collect / wallet debit.
 * Totals update on the order; payment adjustment (if needed) is handled separately by ops.
 */
export async function updatePickupItems(
  orderId: string,
  communityId: string,
  items: PickupLineItem[],
): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const { subtotal, lineItems, nameByService } = await replaceOrderItems(
    orderId,
    communityId,
    items,
  );

  const { error: orderError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .update({
      subtotal,
      total_amount: subtotal,
    })
    .eq('id', orderId);

  if (orderError) throw new Error(orderError.message);

  const garmentCount = lineItems.reduce((s, l) => s + l.quantity, 0);
  const lines = lineItems
    .map((item) => `${item.quantity}× ${nameByService[item.service_id] || 'Garment'}`)
    .join(', ');

  await (supabase.from('order_events') as ReturnType<typeof supabase.from>).insert({
    order_id: orderId,
    status: 'picked_up',
    note: `Pickup items updated\n\n${lines}\n\nAmount: ₹${subtotal}`,
    actor_id: AUTH_PROVIDER === 'mock' ? MOCK_RIDER_ID : riderId,
    metadata: {
      source: 'rider_edit_pickup_items',
      garment_count: garmentCount,
      final_amount: subtotal,
    },
  });

  clearJobsCache();
}

/** Delivery slot calendar day (IST) is today or earlier. */
function isDeliveryDayReached(windowStart: string | null | undefined): boolean {
  if (!windowStart) return false;
  const slotDay = new Date(windowStart).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
  });
  return slotDay <= today;
}
