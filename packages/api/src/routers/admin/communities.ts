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

  listPickupSlots: adminProcedure
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_pickup_slots')
        .select('id, community_id, start_hour, capacity, sort_order, is_active, created_at')
        .eq('community_id', input.communityId)
        .order('sort_order', { ascending: true })
        .order('start_hour', { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    }),

  addPickupSlot: adminProcedure
    .input(
      z.object({
        communityId: z.string().uuid(),
        startHour: z.number().int().min(0).max(23),
        capacity: z.number().int().min(1).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_pickup_slots')
        .insert({
          community_id: input.communityId,
          start_hour: input.startHour,
          capacity: input.capacity ?? 50,
          sort_order: input.startHour,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`A ${input.startHour}:00 slot already exists for this community`);
        }
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.pickup_slot.add',
        entityType: 'community',
        entityId: input.communityId,
        after: { startHour: input.startHour, slotId: data.id },
      });

      return { id: data.id };
    }),

  setPickupSlotActive: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        communityId: z.string().uuid(),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('community_pickup_slots')
        .update({ is_active: input.isActive })
        .eq('id', input.id)
        .eq('community_id', input.communityId);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.pickup_slot.set_active',
        entityType: 'community',
        entityId: input.communityId,
        after: { slotId: input.id, isActive: input.isActive },
      });

      return { success: true };
    }),

  removePickupSlot: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        communityId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('community_pickup_slots')
        .delete()
        .eq('id', input.id)
        .eq('community_id', input.communityId);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.pickup_slot.remove',
        entityType: 'community',
        entityId: input.communityId,
        after: { slotId: input.id },
      });

      return { success: true };
    }),
});
