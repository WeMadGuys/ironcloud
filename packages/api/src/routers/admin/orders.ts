import type { OrderStatus, TypedSupabaseClient } from '@ironcloud/db';
import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { ensureDeliveryRiderJob } from '../../lib/ensureDeliveryJob';
import { adminProcedure, router } from '../../trpc/init';

const orderStatusSchema = z.enum([
  'draft', 'booked', 'pickup_assigned', 'pickup_in_progress', 'picked_up',
  'picked_up_no_delivery',
  'warehouse_received', 'sorting', 'ironing', 'quality_check', 'packed',
  'ready_for_delivery', 'delivery_assigned', 'out_for_delivery', 'delivered',
  'completed', 'rated', 'cancelled', 'failed', 'refund_initiated', 'refund_completed',
]);

const DELIVERY_ASSIGN_STATUSES = new Set(['delivery_assigned', 'out_for_delivery']);
const SKIP_DELIVERY_DATE = new Set(['cancelled', 'delivered', 'completed', 'rated']);

type Clock = { h: number; m: number; s: number };
type SlotWindow = { window_start: string; window_end: string };

function asSlot(value: SlotWindow | SlotWindow[] | null | undefined): SlotWindow | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function clockInKolkata(iso: string): Clock {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  let h = read('hour');
  if (h === 24) h = 0;
  return { h, m: read('minute'), s: read('second') };
}

function atKolkata(day: string, clock: Clock): Date {
  const hh = String(clock.h).padStart(2, '0');
  const mm = String(clock.m).padStart(2, '0');
  const ss = String(clock.s).padStart(2, '0');
  return new Date(`${day}T${hh}:${mm}:${ss}+05:30`);
}

async function ensureDeliverySlot(
  supabase: TypedSupabaseClient,
  communityId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<string> {
  const windowStartIso = windowStart.toISOString();
  const windowEndIso = windowEnd.toISOString();

  const findExisting = async () => {
    const { data, error } = await supabase
      .from('service_slots')
      .select('id, booked_count')
      .eq('community_id', communityId)
      .eq('slot_type', 'delivery')
      .eq('window_start', windowStartIso)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };

  const existing = await findExisting();
  if (existing) {
    const { error } = await supabase
      .from('service_slots')
      .update({ booked_count: (existing.booked_count ?? 0) + 1 })
      .eq('id', existing.id);
    if (error) throw new Error(error.message);
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from('service_slots')
    .insert({
      community_id: communityId,
      slot_type: 'delivery',
      window_start: windowStartIso,
      window_end: windowEndIso,
      capacity: 50,
      booked_count: 1,
    })
    .select('id')
    .single();

  if (!insertError && created) return created.id;

  const raced = await findExisting();
  if (raced) {
    const { error } = await supabase
      .from('service_slots')
      .update({ booked_count: (raced.booked_count ?? 0) + 1 })
      .eq('id', raced.id);
    if (error) throw new Error(error.message);
    return raced.id;
  }

  throw new Error(insertError?.message || 'Failed to reserve delivery slot');
}

export const ordersRouter = router({
  updateStatus: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      status: orderStatusSchema,
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: before } = await ctx.supabase
        .from('orders')
        .select('status')
        .eq('id', input.orderId)
        .single();

      let deliveryRiderId: string | undefined;
      if (DELIVERY_ASSIGN_STATUSES.has(input.status)) {
        const ensured = await ensureDeliveryRiderJob(ctx.supabase, input.orderId);
        deliveryRiderId = ensured.riderId;
      }

      const { error } = await ctx.supabase
        .from('orders')
        .update({ status: input.status })
        .eq('id', input.orderId);

      if (error) throw new Error(error.message);

      await ctx.supabase.from('order_events').insert({
        order_id: input.orderId,
        status: input.status,
        actor_id: ctx.userId,
        note: input.note ?? null,
        metadata: deliveryRiderId
          ? { rider_id: deliveryRiderId, source: 'admin_status_update' }
          : {},
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.status_update',
        entityType: 'order',
        entityId: input.orderId,
        before: before ? { status: before.status } : undefined,
        after: {
          status: input.status,
          ...(deliveryRiderId ? { deliveryRiderId } : {}),
        },
      });

      return { success: true, deliveryRiderId };
    }),

  bulkUpdateStatus: adminProcedure
    .input(z.object({
      orderIds: z.array(z.string().uuid()).min(1).max(50),
      status: orderStatusSchema,
      note: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (DELIVERY_ASSIGN_STATUSES.has(input.status)) {
        for (const orderId of input.orderIds) {
          await ensureDeliveryRiderJob(ctx.supabase, orderId);
        }
      }

      const { error } = await ctx.supabase
        .from('orders')
        .update({ status: input.status })
        .in('id', input.orderIds);

      if (error) throw new Error(error.message);

      await ctx.supabase.from('order_events').insert(
        input.orderIds.map((orderId) => ({
          order_id: orderId,
          status: input.status,
          actor_id: ctx.userId,
          note: input.note ?? 'Bulk status update',
        })),
      );

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.bulk_status_update',
        entityType: 'order',
        entityId: input.orderIds[0],
        after: { status: input.status, orderIds: input.orderIds, count: input.orderIds.length },
      });

      return { success: true, count: input.orderIds.length };
    }),

  assignPartner: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      partnerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('orders')
        .update({ partner_id: input.partnerId })
        .eq('id', input.orderId);

      await ctx.supabase.from('partner_orders').upsert({
        partner_id: input.partnerId,
        order_id: input.orderId,
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.assign_partner',
        entityType: 'order',
        entityId: input.orderId,
        after: { partnerId: input.partnerId },
      });

      return { success: true };
    }),

  assignRider: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      riderId: z.string().uuid(),
      jobType: z.enum(['pickup', 'delivery']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('rider_jobs').insert({
        order_id: input.orderId,
        rider_id: input.riderId,
        job_type: input.jobType,
        status: 'assigned',
      });

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.assign_rider',
        entityType: 'order',
        entityId: input.orderId,
        after: { riderId: input.riderId, jobType: input.jobType },
      });

      return { success: true };
    }),

  cancel: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', input.orderId);

      await ctx.supabase.from('order_events').insert({
        order_id: input.orderId,
        status: 'cancelled',
        actor_id: ctx.userId,
        note: input.reason ?? null,
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.cancel',
        entityType: 'order',
        entityId: input.orderId,
      });

      return { success: true };
    }),

  addNote: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      note: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: order } = await ctx.supabase
        .from('orders')
        .select('admin_notes')
        .eq('id', input.orderId)
        .single();

      const existing = order?.admin_notes ?? '';
      const updated = existing ? `${existing}\n${input.note}` : input.note;

      await ctx.supabase
        .from('orders')
        .update({ admin_notes: updated })
        .eq('id', input.orderId);

      return { success: true };
    }),

  reschedule: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      pickupSlotId: z.string().uuid().optional(),
      deliverySlotId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, string> = {};
      if (input.pickupSlotId) updates.pickup_slot_id = input.pickupSlotId;
      if (input.deliverySlotId) updates.delivery_slot_id = input.deliverySlotId;

      await ctx.supabase.from('orders').update(updates).eq('id', input.orderId);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.reschedule',
        entityType: 'order',
        entityId: input.orderId,
        after: updates,
      });

      return { success: true };
    }),

  setDeliveryDate: adminProcedure
    .input(z.object({
      orderIds: z.array(z.string().uuid()).min(1).max(50),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('orders')
        .select(`
          id, status, community_id, delivery_slot_id,
          delivery_slot:delivery_slot_id (window_start, window_end),
          pickup_slot:pickup_slot_id (window_start, window_end)
        `)
        .in('id', input.orderIds);

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as {
        id: string;
        status: string;
        community_id: string | null;
        delivery_slot_id: string | null;
        delivery_slot: SlotWindow | SlotWindow[] | null;
        pickup_slot: SlotWindow | SlotWindow[] | null;
      }[];

      let updated = 0;
      let skipped = 0;

      for (const row of rows) {
        if (SKIP_DELIVERY_DATE.has(row.status)) {
          skipped += 1;
          continue;
        }
        if (!row.community_id) {
          throw new Error('Order is missing a community.');
        }

        const delivery = asSlot(row.delivery_slot);
        const pickup = asSlot(row.pickup_slot);
        let startSource = delivery?.window_start;
        let endSource = delivery?.window_end;
        if (!startSource || !endSource) {
          if (!pickup?.window_start || !pickup.window_end) {
            throw new Error('Order has no pickup or delivery time to keep.');
          }
          startSource = new Date(new Date(pickup.window_start).getTime() + 86_400_000).toISOString();
          endSource = new Date(new Date(pickup.window_end).getTime() + 86_400_000).toISOString();
        }

        const windowStart = atKolkata(input.date, clockInKolkata(startSource));
        let windowEnd = atKolkata(input.date, clockInKolkata(endSource));
        if (windowEnd.getTime() <= windowStart.getTime()) {
          windowEnd = new Date(windowEnd.getTime() + 86_400_000);
        }

        const sameSlot = Boolean(
          row.delivery_slot_id &&
            delivery?.window_start &&
            new Date(delivery.window_start).getTime() === windowStart.getTime(),
        );
        const slotId = sameSlot && row.delivery_slot_id
          ? row.delivery_slot_id
          : await ensureDeliverySlot(ctx.supabase, row.community_id, windowStart, windowEnd);

        if (!sameSlot && row.delivery_slot_id && row.delivery_slot_id !== slotId) {
          const { error: releaseError } = await ctx.supabase.rpc('release_service_slot_seat', {
            p_slot_id: row.delivery_slot_id,
          });
          if (releaseError) throw new Error(releaseError.message);
        }

        const nextStatus = row.status === 'picked_up_no_delivery' ? 'picked_up' : row.status;
        const { error: updateError } = await ctx.supabase
          .from('orders')
          .update({
            delivery_slot_id: slotId,
            ...(nextStatus !== row.status ? { status: nextStatus as 'picked_up' } : {}),
          })
          .eq('id', row.id);
        if (updateError) throw new Error(updateError.message);

        const { data: openJobs, error: jobsError } = await ctx.supabase
          .from('rider_jobs')
          .select('id')
          .eq('order_id', row.id)
          .eq('job_type', 'delivery')
          .in('status', ['assigned', 'in_progress']);
        if (jobsError) throw new Error(jobsError.message);

        if (openJobs && openJobs.length > 0) {
          const { error: jobError } = await ctx.supabase
            .from('rider_jobs')
            .update({
              scheduled_start: windowStart.toISOString(),
              scheduled_end: windowEnd.toISOString(),
            })
            .eq('order_id', row.id)
            .eq('job_type', 'delivery')
            .in('status', ['assigned', 'in_progress']);
          if (jobError) throw new Error(jobError.message);
        } else {
          await ensureDeliveryRiderJob(ctx.supabase, row.id);
        }

        const { error: eventError } = await ctx.supabase.from('order_events').insert({
          order_id: row.id,
          status: nextStatus as OrderStatus,
          actor_id: ctx.userId,
          note: `Delivery date set to ${input.date}`,
          metadata: {
            source: 'admin_set_delivery_date',
            delivery_date: input.date,
            window_start: windowStart.toISOString(),
            window_end: windowEnd.toISOString(),
          },
        });
        if (eventError) throw new Error(eventError.message);

        updated += 1;
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.set_delivery_date',
        entityType: 'order',
        entityId: input.orderIds[0],
        after: { date: input.date, orderIds: input.orderIds, updated, skipped },
      });

      return { success: true, updated, skipped };
    }),

  /** Manually run delivery-day advance (same as nightly cron). */
  advanceDeliveryDay: adminProcedure.mutation(async ({ ctx }) => {
    const { data, error } = await ctx.supabase.rpc('advance_orders_for_delivery_day');

    if (error) throw new Error(error.message);

    const advanced = typeof data === 'number' ? data : Number(data ?? 0);

    await writeAuditLog({
      supabase: ctx.supabase,
      actorId: ctx.userId,
      action: 'order.advance_delivery_day',
      entityType: 'order',
      entityId: ctx.userId,
      after: { advanced },
    });

    return { success: true, advanced };
  }),

  refund: adminProcedure
    .input(z.discriminatedUnion('kind', [
      z.object({
        kind: z.literal('items'),
        orderId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
        lines: z.array(z.object({
          orderItemId: z.string().uuid(),
          quantity: z.number().int().positive(),
        })).min(1),
      }),
      z.object({
        kind: z.literal('custom'),
        orderId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
        amount: z.number().positive(),
      }),
    ]))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase.rpc('refund_order_to_wallet', {
        p_order_id: input.orderId,
        p_actor_id: ctx.userId,
        p_idempotency_key: input.idempotencyKey,
        p_kind: input.kind,
        p_custom_amount: input.kind === 'custom' ? input.amount : null,
        p_lines: input.kind === 'items'
          ? input.lines.map((line) => ({
            order_item_id: line.orderItemId,
            quantity: line.quantity,
          }))
          : [],
      });

      if (error) throw new Error(error.message);
      if (!data || typeof data !== 'object') throw new Error('Refund failed');

      const receipt = data as {
        amount?: number | string;
        balance?: number | string;
        description?: string;
        remaining?: number | string;
        idempotent?: boolean;
      };

      const amount = Number(receipt.amount);
      const balance = Number(receipt.balance);
      const remaining = Number(receipt.remaining);
      if (!Number.isFinite(amount) || !Number.isFinite(balance) || !Number.isFinite(remaining)) {
        throw new Error('Refund failed');
      }

      if (!receipt.idempotent) {
        await writeAuditLog({
          supabase: ctx.supabase,
          actorId: ctx.userId,
          action: 'wallet.refund',
          entityType: 'order',
          entityId: input.orderId,
          after: {
            amount,
            kind: input.kind,
            description: receipt.description ?? '',
            balance,
            remaining,
          },
        });
      }

      return {
        amount,
        balance,
        description: receipt.description ?? '',
        remaining,
      };
    }),
});
