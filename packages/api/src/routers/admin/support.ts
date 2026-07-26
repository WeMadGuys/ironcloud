import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router, z } from '../../trpc/init';

export const supportRouter = router({
  reply: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        message: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: ticket, error: ticketError } = await ctx.supabase
        .from('support_tickets')
        .select('id, status')
        .eq('id', input.ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new Error(ticketError?.message || 'Ticket not found');
      }

      if (ticket.status === 'resolved' || ticket.status === 'closed') {
        throw new Error('Ticket is resolved. Reopen it before replying.');
      }

      const { data, error } = await ctx.supabase
        .from('ticket_messages')
        .insert({
          ticket_id: input.ticketId,
          sender_id: ctx.userId,
          message: input.message.trim(),
        })
        .select('id, ticket_id, sender_id, message, created_at')
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Failed to send reply');
      }

      if (ticket.status === 'open') {
        await ctx.supabase
          .from('support_tickets')
          .update({ status: 'in_progress' })
          .eq('id', input.ticketId);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'support.reply',
        entityType: 'support_ticket',
        entityId: input.ticketId,
      });

      return data;
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        ticketId: z.string().uuid(),
        status: z.enum(['open', 'in_progress', 'escalated', 'resolved', 'closed']),
        resolutionNote: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: {
        status: typeof input.status;
        resolved_at?: string | null;
        resolution_note?: string | null;
      } = { status: input.status };

      if (input.status === 'resolved' || input.status === 'closed') {
        updates.resolved_at = new Date().toISOString();
        if (input.resolutionNote !== undefined) {
          updates.resolution_note = input.resolutionNote.trim() || null;
        }
      } else {
        updates.resolved_at = null;
      }

      const { error } = await ctx.supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', input.ticketId);

      if (error) {
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'support.updateStatus',
        entityType: 'support_ticket',
        entityId: input.ticketId,
        after: updates,
      });

      return { success: true };
    }),
});
