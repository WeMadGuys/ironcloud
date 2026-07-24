import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

export const financeRouter = router({
  createSettlement: adminProcedure
    .input(z.object({
      partnerId: z.string().uuid().optional(),
      riderId: z.string().uuid().optional(),
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
      amount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('settlements')
        .insert({
          partner_id: input.partnerId ?? null,
          rider_id: input.riderId ?? null,
          period_start: input.periodStart,
          period_end: input.periodEnd,
          amount: input.amount,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'settlement.create',
        entityType: 'settlement',
        entityId: data.id,
        after: { amount: input.amount },
      });

      return { id: data.id };
    }),

  markSettlementPaid: adminProcedure
    .input(z.object({ settlementId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('settlements')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', input.settlementId);

      return { success: true };
    }),

  generateInvoice: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      gstRate: z.number().min(0).max(100).default(18),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: order } = await ctx.supabase
        .from('orders')
        .select('order_number, subtotal, total_amount')
        .eq('id', input.orderId)
        .single();

      if (!order) throw new Error('Order not found');

      const subtotal = Number(order.subtotal);
      const gstAmount = subtotal * (input.gstRate / 100);
      const total = subtotal + gstAmount;
      const invoiceNumber = `INV-${order.order_number}`;

      const { data, error } = await ctx.supabase
        .from('invoices')
        .insert({
          order_id: input.orderId,
          invoice_number: invoiceNumber,
          subtotal,
          gst_amount: gstAmount,
          total,
        })
        .select('id, invoice_number')
        .single();

      if (error) throw new Error(error.message);

      return data;
    }),
});
