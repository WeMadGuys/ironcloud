import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

export const partnersRouter = router({
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      capacity: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('partners')
        .insert({
          name: input.name,
          contact_name: input.contactName ?? null,
          phone: input.phone ?? null,
          email: input.email ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          capacity: input.capacity ?? 50,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'partner.create',
        entityType: 'partner',
        entityId: data.id,
        after: { name: input.name },
      });

      return { id: data.id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.union([z.string().email(), z.literal('')]).optional(),
      city: z.string().optional(),
      capacity: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        name: input.name.trim(),
        contact_name: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        city: input.city?.trim() || null,
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      };

      const { error } = await ctx.supabase
        .from('partners')
        .update(updates)
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'partner.update',
        entityType: 'partner',
        entityId: input.id,
        after: updates,
      });

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('partners').delete().eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'partner.delete',
        entityType: 'partner',
        entityId: input.id,
      });

      return { success: true };
    }),

  verify: adminProcedure
    .input(z.object({
      partnerId: z.string().uuid(),
      verificationStatus: z.enum(['pending', 'verified', 'rejected']),
      kycStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, string> = {
        verification_status: input.verificationStatus,
      };
      if (input.kycStatus) updates.kyc_status = input.kycStatus;

      await ctx.supabase
        .from('partners')
        .update(updates)
        .eq('id', input.partnerId);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'partner.verify',
        entityType: 'partner',
        entityId: input.partnerId,
        after: updates,
      });

      return { success: true };
    }),

  updateCapacity: adminProcedure
    .input(z.object({
      partnerId: z.string().uuid(),
      capacity: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('partners')
        .update({ capacity: input.capacity })
        .eq('id', input.partnerId);

      return { success: true };
    }),
});
