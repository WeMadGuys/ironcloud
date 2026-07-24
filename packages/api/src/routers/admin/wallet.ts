import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

export const walletRouter = router({
  credit: adminProcedure
    .input(z.object({
      walletId: z.string().uuid(),
      amount: z.number().positive(),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: wallet } = await ctx.supabase
        .from('wallets')
        .select('balance, customer_id')
        .eq('id', input.walletId)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      const newBalance = Number(wallet.balance) + input.amount;

      await ctx.supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', input.walletId);

      await ctx.supabase.from('wallet_transactions').insert({
        wallet_id: input.walletId,
        type: 'recharge',
        amount: input.amount,
        balance_after: newBalance,
        description: input.description ?? 'Admin credit',
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'wallet.credit',
        entityType: 'wallet',
        entityId: input.walletId,
        after: { amount: input.amount, balance: newBalance },
      });

      return { success: true, balance: newBalance };
    }),

  debit: adminProcedure
    .input(z.object({
      walletId: z.string().uuid(),
      amount: z.number().positive(),
      description: z.string().optional(),
      orderId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: wallet } = await ctx.supabase
        .from('wallets')
        .select('balance')
        .eq('id', input.walletId)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      const newBalance = Number(wallet.balance) - input.amount;
      if (newBalance < 0) throw new Error('Insufficient balance');

      await ctx.supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', input.walletId);

      await ctx.supabase.from('wallet_transactions').insert({
        wallet_id: input.walletId,
        type: 'debit',
        amount: -input.amount,
        balance_after: newBalance,
        order_id: input.orderId ?? null,
        description: input.description ?? 'Admin debit',
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'wallet.debit',
        entityType: 'wallet',
        entityId: input.walletId,
        after: { amount: input.amount, balance: newBalance },
      });

      return { success: true, balance: newBalance };
    }),

  refund: adminProcedure
    .input(z.object({
      orderId: z.string().uuid(),
      amount: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: order } = await ctx.supabase
        .from('orders')
        .select('customer_id, total_amount')
        .eq('id', input.orderId)
        .single();

      if (!order) throw new Error('Order not found');

      const { data: wallet } = await ctx.supabase
        .from('wallets')
        .select('id, balance')
        .eq('customer_id', order.customer_id)
        .single();

      if (!wallet) throw new Error('Wallet not found');

      const newBalance = Number(wallet.balance) + input.amount;

      await ctx.supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', wallet.id);

      await ctx.supabase.from('wallet_transactions').insert({
        wallet_id: wallet.id,
        type: 'refund',
        amount: input.amount,
        balance_after: newBalance,
        order_id: input.orderId,
        description: 'Order refund',
      });

      await ctx.supabase
        .from('orders')
        .update({ status: 'refund_completed' })
        .eq('id', input.orderId);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'wallet.refund',
        entityType: 'order',
        entityId: input.orderId,
        after: { amount: input.amount },
      });

      return { success: true };
    }),
});
