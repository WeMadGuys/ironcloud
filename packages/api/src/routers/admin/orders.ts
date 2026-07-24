import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

const orderStatusSchema = z.enum([
  'draft', 'booked', 'pickup_assigned', 'pickup_in_progress', 'picked_up',
  'warehouse_received', 'sorting', 'ironing', 'quality_check', 'packed',
  'ready_for_delivery', 'delivery_assigned', 'out_for_delivery', 'delivered',
  'completed', 'rated', 'cancelled', 'refund_initiated', 'refund_completed',
]);

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
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'order.status_update',
        entityType: 'order',
        entityId: input.orderId,
        before: before ? { status: before.status } : undefined,
        after: { status: input.status },
      });

      return { success: true };
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
});
