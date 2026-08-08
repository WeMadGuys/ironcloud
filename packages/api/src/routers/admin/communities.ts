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
      blocksEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('communities')
        .insert({
          name: input.name.trim(),
          city: input.city.trim(),
          pricing_tier: input.pricingTier?.trim() || 'standard',
          status: input.status ?? 'active',
          blocks_enabled: input.blocksEnabled ?? false,
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
        after: {
          name: input.name,
          city: input.city,
          blocksEnabled: input.blocksEnabled ?? false,
        },
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
      blocksEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        name: input.name.trim(),
        city: input.city.trim(),
        pricing_tier: input.pricingTier?.trim() || 'standard',
        status: input.status ?? 'active',
        blocks_enabled: input.blocksEnabled ?? false,
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

  listBlocks: adminProcedure
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_blocks')
        .select('id, community_id, name, sort_order, is_active, created_at')
        .eq('community_id', input.communityId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    }),

  createBlock: adminProcedure
    .input(
      z.object({
        communityId: z.string().uuid(),
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim();
      const { data, error } = await ctx.supabase
        .from('community_blocks')
        .insert({
          community_id: input.communityId,
          name,
          sort_order: 0,
          is_active: true,
        })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Block "${name}" already exists for this community`);
        }
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.block.create',
        entityType: 'community',
        entityId: input.communityId,
        after: { blockId: data.id, name },
      });

      return { id: data.id };
    }),

  updateBlock: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        communityId: z.string().uuid(),
        name: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: { name?: string; is_active?: boolean } = {};
      if (input.name != null) updates.name = input.name.trim();
      if (input.isActive != null) updates.is_active = input.isActive;

      if (Object.keys(updates).length === 0) {
        throw new Error('Nothing to update');
      }

      const { error } = await ctx.supabase
        .from('community_blocks')
        .update(updates)
        .eq('id', input.id)
        .eq('community_id', input.communityId);

      if (error) {
        if (error.code === '23505') {
          throw new Error('A block with that name already exists');
        }
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.block.update',
        entityType: 'community',
        entityId: input.communityId,
        after: { blockId: input.id, ...updates },
      });

      return { success: true };
    }),

  listFlats: adminProcedure
    .input(z.object({ blockId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_flats')
        .select('id, block_id, flat_number, sort_order, is_active, created_at')
        .eq('block_id', input.blockId)
        .order('sort_order', { ascending: true })
        .order('flat_number', { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    }),

  createFlats: adminProcedure
    .input(
      z.object({
        communityId: z.string().uuid(),
        blockId: z.string().uuid(),
        flatNumbers: z.array(z.string().min(1)).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: block, error: blockError } = await ctx.supabase
        .from('community_blocks')
        .select('id')
        .eq('id', input.blockId)
        .eq('community_id', input.communityId)
        .maybeSingle();

      if (blockError) throw new Error(blockError.message);
      if (!block) throw new Error('Block not found for this community');

      const seen = new Set<string>();
      const rows: { block_id: string; flat_number: string; sort_order: number; is_active: boolean }[] =
        [];

      for (const raw of input.flatNumbers) {
        const flat_number = raw.trim();
        if (!flat_number) continue;
        const key = flat_number.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          block_id: input.blockId,
          flat_number,
          sort_order: 0,
          is_active: true,
        });
      }

      if (rows.length === 0) {
        throw new Error('Enter at least one flat number');
      }

      const { data, error } = await ctx.supabase
        .from('community_flats')
        .insert(rows)
        .select('id');

      if (error) {
        // Unique expression index — insert one-by-one and skip duplicates.
        let created = 0;
        for (const row of rows) {
          const { error: insertError } = await ctx.supabase
            .from('community_flats')
            .insert(row);
          if (!insertError) {
            created += 1;
          } else if (insertError.code !== '23505') {
            throw new Error(insertError.message);
          }
        }
        if (created === 0) {
          throw new Error('Those flats already exist for this block');
        }
        await writeAuditLog({
          supabase: ctx.supabase,
          actorId: ctx.userId,
          action: 'community.flats.create',
          entityType: 'community',
          entityId: input.communityId,
          after: { blockId: input.blockId, created },
        });
        return { created };
      }

      const created = data?.length ?? rows.length;
      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.flats.create',
        entityType: 'community',
        entityId: input.communityId,
        after: { blockId: input.blockId, created },
      });

      return { created };
    }),

  updateFlat: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        blockId: z.string().uuid(),
        communityId: z.string().uuid(),
        flatNumber: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: block, error: blockError } = await ctx.supabase
        .from('community_blocks')
        .select('id')
        .eq('id', input.blockId)
        .eq('community_id', input.communityId)
        .maybeSingle();

      if (blockError) throw new Error(blockError.message);
      if (!block) throw new Error('Block not found for this community');

      const updates: { flat_number?: string; is_active?: boolean } = {};
      if (input.flatNumber != null) updates.flat_number = input.flatNumber.trim();
      if (input.isActive != null) updates.is_active = input.isActive;

      if (Object.keys(updates).length === 0) {
        throw new Error('Nothing to update');
      }

      const { error } = await ctx.supabase
        .from('community_flats')
        .update(updates)
        .eq('id', input.id)
        .eq('block_id', input.blockId);

      if (error) {
        if (error.code === '23505') {
          throw new Error('A flat with that number already exists in this block');
        }
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.flat.update',
        entityType: 'community',
        entityId: input.communityId,
        after: { flatId: input.id, blockId: input.blockId, ...updates },
      });

      return { success: true };
    }),
});
