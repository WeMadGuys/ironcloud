import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router, z } from '../../trpc/init';

const stageSchema = z.enum([
  'lead',
  'contacted',
  'meeting_scheduled',
  'approved',
  'onboarding',
  'active',
  'paused',
  'lost',
]);

const optionalText = z.string().trim().max(500).nullish();

const addressSchema = {
  addressLine: optionalText,
  locality: optionalText,
  pincode: z
    .string()
    .trim()
    .regex(/^(\d{6})?$/, 'Pincode must be 6 digits')
    .nullish(),
  state: optionalText,
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
};

type AddressInput = {
  addressLine?: string | null;
  locality?: string | null;
  pincode?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const emptyToNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null);

/** Only keys present in the input are written, so partial updates leave other fields alone. */
const addressColumns = (input: AddressInput) => {
  const columns: Record<string, string | number | null> = {};
  if (input.addressLine !== undefined) columns.address_line = emptyToNull(input.addressLine);
  if (input.locality !== undefined) columns.locality = emptyToNull(input.locality);
  if (input.pincode !== undefined) columns.pincode = emptyToNull(input.pincode);
  if (input.state !== undefined) columns.state = emptyToNull(input.state);
  if (input.latitude !== undefined) columns.latitude = input.latitude ?? null;
  if (input.longitude !== undefined) columns.longitude = input.longitude ?? null;
  return columns;
};

const contactSchema = {
  name: z.string().trim().min(1).max(200),
  position: optionalText,
  phone: z.string().trim().max(30).nullish(),
  email: z.string().trim().email().or(z.literal('')).nullish(),
  isPrimary: z.boolean().optional(),
};

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
      stage: stageSchema.optional(),
      blocksEnabled: z.boolean().optional(),
      ...addressSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const stage = input.stage ?? 'lead';
      const { data, error } = await ctx.supabase
        .from('communities')
        .insert({
          name: input.name.trim(),
          city: input.city.trim(),
          pricing_tier: input.pricingTier?.trim() || 'standard',
          stage,
          blocks_enabled: input.blocksEnabled ?? false,
          ...addressColumns(input),
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await ctx.supabase.from('community_stage_history').insert({
        community_id: data.id,
        from_stage: null,
        to_stage: stage,
        changed_by: ctx.userId,
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.create',
        entityType: 'community',
        entityId: data.id,
        after: {
          name: input.name,
          city: input.city,
          stage,
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
      stage: stageSchema.optional(),
      blocksEnabled: z.boolean().optional(),
      ...addressSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing, error: existingError } = await ctx.supabase
        .from('communities')
        .select('stage')
        .eq('id', input.id)
        .single();
      if (existingError) throw new Error(existingError.message);

      const updates: Record<string, unknown> = {
        name: input.name.trim(),
        city: input.city.trim(),
        pricing_tier: input.pricingTier?.trim() || 'standard',
        blocks_enabled: input.blocksEnabled ?? false,
        ...addressColumns(input),
      };
      const stageChanged = input.stage !== undefined && input.stage !== existing.stage;
      if (stageChanged) updates.stage = input.stage;

      const { error } = await ctx.supabase
        .from('communities')
        .update(updates)
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      if (stageChanged) {
        await ctx.supabase.from('community_stage_history').insert({
          community_id: input.id,
          from_stage: existing.stage,
          to_stage: input.stage,
          changed_by: ctx.userId,
        });
      }

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
      const [orders, boxes] = await Promise.all([
        ctx.supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', input.id),
        ctx.supabase
          .from('boxes')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', input.id),
      ]);
      if (orders.error) throw new Error(orders.error.message);
      if (boxes.error) throw new Error(boxes.error.message);

      if ((orders.count ?? 0) > 0) {
        throw new Error(
          `This apartment has ${orders.count} order(s) and can't be deleted. Suspend it instead.`,
        );
      }
      if ((boxes.count ?? 0) > 0) {
        throw new Error(
          `This apartment has ${boxes.count} box(es) assigned. Remove or reassign them before deleting.`,
        );
      }

      for (const table of ['addresses', 'service_slots', 'pricing_rules'] as const) {
        const { error } = await ctx.supabase.from(table).delete().eq('community_id', input.id);
        if (error) {
          if (error.code === '23503') {
            throw new Error("This apartment is still referenced by existing orders and can't be deleted. Suspend it instead.");
          }
          throw new Error(error.message);
        }
      }

      const { error } = await ctx.supabase.from('communities').delete().eq('id', input.id);
      if (error) {
        if (error.code === '23503') {
          throw new Error("This apartment is still in use and can't be deleted. Suspend it instead.");
        }
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.delete',
        entityType: 'community',
        entityId: input.id,
      });

      return { success: true };
    }),

  setStage: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      stage: stageSchema,
      note: z.string().trim().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing, error: existingError } = await ctx.supabase
        .from('communities')
        .select('stage')
        .eq('id', input.id)
        .single();
      if (existingError) throw new Error(existingError.message);
      if (existing.stage === input.stage) {
        throw new Error('Community is already in that stage');
      }

      const { error } = await ctx.supabase
        .from('communities')
        .update({ stage: input.stage })
        .eq('id', input.id);
      if (error) throw new Error(error.message);

      const { error: historyError } = await ctx.supabase.from('community_stage_history').insert({
        community_id: input.id,
        from_stage: existing.stage,
        to_stage: input.stage,
        note: input.note || null,
        changed_by: ctx.userId,
      });
      if (historyError) throw new Error(historyError.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.stage.change',
        entityType: 'community',
        entityId: input.id,
        before: { stage: existing.stage },
        after: { stage: input.stage, note: input.note ?? null },
      });

      return { success: true };
    }),

  listStageHistory: adminProcedure
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_stage_history')
        .select('id, from_stage, to_stage, note, changed_by, created_at')
        .eq('community_id', input.communityId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);

      const rows = data ?? [];
      const actorIds = [...new Set(rows.map((row) => row.changed_by).filter(Boolean))] as string[];
      const names = new Map<string, string | null>();
      if (actorIds.length > 0) {
        const { data: profiles } = await ctx.supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', actorIds);
        for (const profile of profiles ?? []) names.set(profile.id, profile.full_name);
      }

      return rows.map((row) => ({
        ...row,
        changedByName: row.changed_by ? names.get(row.changed_by) ?? null : null,
      }));
    }),

  updateAddress: adminProcedure
    .input(z.object({ id: z.string().uuid(), ...addressSchema }))
    .mutation(async ({ ctx, input }) => {
      const updates = addressColumns(input);
      const { error } = await ctx.supabase
        .from('communities')
        .update(updates)
        .eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.address.update',
        entityType: 'community',
        entityId: input.id,
        after: updates,
      });

      return { success: true };
    }),

  listContacts: adminProcedure
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_contacts')
        .select('id, community_id, name, position, phone, email, is_primary, created_at')
        .eq('community_id', input.communityId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),

  createContact: adminProcedure
    .input(z.object({ communityId: z.string().uuid(), ...contactSchema }))
    .mutation(async ({ ctx, input }) => {
      const { count, error: countError } = await ctx.supabase
        .from('community_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', input.communityId);
      if (countError) throw new Error(countError.message);

      // The first contact becomes primary so there is always someone to call.
      const isPrimary = input.isPrimary ?? (count ?? 0) === 0;
      if (isPrimary) {
        const { error: clearError } = await ctx.supabase
          .from('community_contacts')
          .update({ is_primary: false })
          .eq('community_id', input.communityId)
          .eq('is_primary', true);
        if (clearError) throw new Error(clearError.message);
      }

      const { data, error } = await ctx.supabase
        .from('community_contacts')
        .insert({
          community_id: input.communityId,
          name: input.name,
          position: emptyToNull(input.position),
          phone: emptyToNull(input.phone),
          email: emptyToNull(input.email),
          is_primary: isPrimary,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.contact.create',
        entityType: 'community',
        entityId: input.communityId,
        after: { contactId: data.id, name: input.name, isPrimary },
      });

      return { id: data.id };
    }),

  updateContact: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      communityId: z.string().uuid(),
      name: contactSchema.name.optional(),
      position: contactSchema.position,
      phone: contactSchema.phone,
      email: contactSchema.email,
      isPrimary: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, string | boolean | null> = {};
      if (input.name !== undefined) updates.name = input.name;
      if (input.position !== undefined) updates.position = emptyToNull(input.position);
      if (input.phone !== undefined) updates.phone = emptyToNull(input.phone);
      if (input.email !== undefined) updates.email = emptyToNull(input.email);
      if (input.isPrimary !== undefined) updates.is_primary = input.isPrimary;

      if (Object.keys(updates).length === 0) throw new Error('Nothing to update');

      if (input.isPrimary) {
        const { error: clearError } = await ctx.supabase
          .from('community_contacts')
          .update({ is_primary: false })
          .eq('community_id', input.communityId)
          .eq('is_primary', true)
          .neq('id', input.id);
        if (clearError) throw new Error(clearError.message);
      }

      const { error } = await ctx.supabase
        .from('community_contacts')
        .update(updates)
        .eq('id', input.id)
        .eq('community_id', input.communityId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.contact.update',
        entityType: 'community',
        entityId: input.communityId,
        after: { contactId: input.id, ...updates },
      });

      return { success: true };
    }),

  deleteContact: adminProcedure
    .input(z.object({ id: z.string().uuid(), communityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('community_contacts')
        .delete()
        .eq('id', input.id)
        .eq('community_id', input.communityId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.contact.delete',
        entityType: 'community',
        entityId: input.communityId,
        after: { contactId: input.id },
      });

      return { success: true };
    }),

  listNextSteps: adminProcedure
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_next_steps')
        .select('id, community_id, body, due_date, is_done, done_at, created_by, created_at')
        .eq('community_id', input.communityId)
        .order('is_done', { ascending: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }),

  createNextStep: adminProcedure
    .input(z.object({
      communityId: z.string().uuid(),
      body: z.string().trim().min(1).max(1000),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('community_next_steps')
        .insert({
          community_id: input.communityId,
          body: input.body,
          due_date: input.dueDate ?? null,
          created_by: ctx.userId,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.next_step.create',
        entityType: 'community',
        entityId: input.communityId,
        after: { stepId: data.id, body: input.body, dueDate: input.dueDate ?? null },
      });

      return { id: data.id };
    }),

  updateNextStep: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      communityId: z.string().uuid(),
      body: z.string().trim().min(1).max(1000).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
      isDone: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, string | boolean | null> = {};
      if (input.body !== undefined) updates.body = input.body;
      if (input.dueDate !== undefined) updates.due_date = input.dueDate ?? null;
      if (input.isDone !== undefined) {
        updates.is_done = input.isDone;
        updates.done_at = input.isDone ? new Date().toISOString() : null;
      }

      if (Object.keys(updates).length === 0) throw new Error('Nothing to update');

      const { error } = await ctx.supabase
        .from('community_next_steps')
        .update(updates)
        .eq('id', input.id)
        .eq('community_id', input.communityId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.next_step.update',
        entityType: 'community',
        entityId: input.communityId,
        after: { stepId: input.id, ...updates },
      });

      return { success: true };
    }),

  deleteNextStep: adminProcedure
    .input(z.object({ id: z.string().uuid(), communityId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('community_next_steps')
        .delete()
        .eq('id', input.id)
        .eq('community_id', input.communityId);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'community.next_step.delete',
        entityType: 'community',
        entityId: input.communityId,
        after: { stepId: input.id },
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
