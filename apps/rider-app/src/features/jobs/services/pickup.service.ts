import { AUTH_PROVIDER, MOCK_RIDER_ID } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
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

export async function confirmPickup(
  orderId: string,
  communityId: string,
  items: PickupLineItem[],
): Promise<void> {
  const riderId = await getRiderId();
  if (!riderId) throw new Error('Rider not authenticated');

  const catalog = await getGarmentCatalog(communityId);
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

  await debitWalletAfterPickup(orderId);
}
