import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router, z } from '../../trpc/init';

export const communitiesRouter = router({
  listOptions: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('communities')
      .select('id, name, city, status')
      .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data ?? [];
  }),

  create: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      city: z.string().min(1),
      pricingTier: z.string().optional(),
      status: z.enum(['pending', 'active', 'suspended']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('communities')
        .insert({
          name: input.name.trim(),
          city: input.city.trim(),
          pricing_tier: input.pricingTier?.trim() || 'standard',
          status: input.status ?? 'active',
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.create',
        entityType: 'community',
        entityId: data.id,
        after: { name: input.name, city: input.city },
      });

      return { id: data.id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      city: z.string().min(1),
      pricingTier: z.string().optional(),
      status: z.enum(['pending', 'active', 'suspended']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        name: input.name.trim(),
        city: input.city.trim(),
        pricing_tier: input.pricingTier?.trim() || 'standard',
        status: input.status ?? 'active',
      };

      const { error } = await ctx.supabase
        .from('communities')
        .update(updates)
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.update',
        entityType: 'community',
        entityId: input.id,
        after: updates,
      });

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('communities').delete().eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.delete',
        entityType: 'community',
        entityId: input.id,
      });

      return { success: true };
    }),
});
