import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { ensureDeliveryRiderJob } from '../../lib/ensureDeliveryJob';
import { adminProcedure, router } from '../../trpc/init';

const orderStatusSchema = z.enum([
  'draft', 'booked', 'pickup_assigned', 'pickup_in_progress', 'picked_up',
  'warehouse_received', 'sorting', 'ironing', 'quality_check', 'packed',
  'ready_for_delivery', 'delivery_assigned', 'out_for_delivery', 'delivered',
  'completed', 'rated', 'cancelled', 'refund_initiated', 'refund_completed',
]);

const DELIVERY_ASSIGN_STATUSES = new Set(['delivery_assigned', 'out_for_delivery']);

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
