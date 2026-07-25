import { writeAuditLog } from '../../lib/audit';
import { createStubProfileUser } from '../../lib/createStubProfile';
import { adminProcedure, router } from '../../trpc/init';
import { z } from 'zod';

export const ridersRouter = router({
  listByCommunity: adminProcedure
    .input(z.object({ communityId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: links, error } = await ctx.supabase
        .from('rider_communities')
        .select('rider_id')
        .eq('community_id', input.communityId);

      if (error) throw new Error(error.message);

      const riderIds = (links ?? []).map((row) => row.rider_id);
      if (riderIds.length === 0) return [];

      const { data: profiles, error: profileError } = await ctx.supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', riderIds)
        .eq('role', 'rider');

      if (profileError) throw new Error(profileError.message);

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return riderIds.map((riderId) => {
        const profile = byId.get(riderId);
        return {
          riderId,
          fullName: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
        };
      });
    }),

  listOptions: adminProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'rider')
      .order('full_name', { ascending: true });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      phone: row.phone,
    }));
  }),

  listCommunitiesForRider: adminProcedure
    .input(z.object({ riderId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: links, error } = await ctx.supabase
        .from('rider_communities')
        .select('community_id')
        .eq('rider_id', input.riderId);

      if (error) throw new Error(error.message);

      const communityIds = (links ?? []).map((row) => row.community_id);
      if (communityIds.length === 0) return [];

      const { data: communities, error: communityError } = await ctx.supabase
        .from('communities')
        .select('id, name, city')
        .in('id', communityIds)
        .order('name', { ascending: true });

      if (communityError) throw new Error(communityError.message);

      return (communities ?? []).map((c) => ({
        communityId: c.id,
        name: c.name,
        city: c.city,
      }));
    }),

  create: adminProcedure
    .input(z.object({
      fullName: z.string().min(1),
      phone: z.string().min(10),
      vehicleNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id } = await createStubProfileUser(ctx.supabase, {
        fullName: input.fullName,
        phone: input.phone,
        role: 'rider',
      });

      const { error: riderError } = await ctx.supabase.from('riders').insert({
        id,
        vehicle_number: input.vehicleNumber?.trim() || null,
        kyc_status: 'pending',
        is_active: false,
      });

      if (riderError) {
        throw new Error(riderError.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'rider.create',
        entityType: 'rider',
        entityId: id,
        after: {
          fullName: input.fullName,
          phone: input.phone,
          vehicleNumber: input.vehicleNumber ?? null,
        },
      });

      return { id };
    }),

  setActive: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('riders')
        .update({ is_active: input.isActive })
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: input.isActive ? 'rider.activate' : 'rider.deactivate',
        entityType: 'rider',
        entityId: input.id,
        after: { isActive: input.isActive },
      });

      return { success: true };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      fullName: z.string().min(1),
      phone: z.string().min(10),
      vehicleNumber: z.string().optional(),
      kycStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const phone = input.phone.replace(/\D/g, '').slice(-10);
      if (phone.length !== 10) throw new Error('Phone must be a 10-digit mobile number');

      const { data: conflict } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .neq('id', input.id)
        .maybeSingle();

      if (conflict) throw new Error('A profile with this phone number already exists');

      const { error: profileError } = await ctx.supabase
        .from('profiles')
        .update({
          full_name: input.fullName.trim(),
          phone,
        })
        .eq('id', input.id)
        .eq('role', 'rider');

      if (profileError) {
        if (profileError.code === '23505') {
          throw new Error('A profile with this phone number already exists');
        }
        throw new Error(profileError.message);
      }

      const riderUpdates: Record<string, string | null> = {
        vehicle_number: input.vehicleNumber?.trim() || null,
      };
      if (input.kycStatus) riderUpdates.kyc_status = input.kycStatus;

      const { error: riderError } = await ctx.supabase
        .from('riders')
        .update(riderUpdates)
        .eq('id', input.id);

      if (riderError) throw new Error(riderError.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'rider.update',
        entityType: 'rider',
        entityId: input.id,
        after: {
          fullName: input.fullName,
          phone,
          vehicleNumber: input.vehicleNumber ?? null,
          kycStatus: input.kycStatus ?? null,
        },
      });

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('rider_communities').delete().eq('rider_id', input.id);

      const { error: riderError } = await ctx.supabase.from('riders').delete().eq('id', input.id);
      if (riderError) throw new Error(riderError.message);

      const { error: profileError } = await ctx.supabase
        .from('profiles')
        .delete()
        .eq('id', input.id);

      if (profileError) throw new Error(profileError.message);

      await ctx.supabase.auth.admin.deleteUser(input.id).catch(() => undefined);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'rider.delete',
        entityType: 'rider',
        entityId: input.id,
      });

      return { success: true };
    }),

  assignCommunity: adminProcedure
    .input(z.object({
      riderId: z.string().uuid(),
      communityId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('rider_communities').upsert(
        {
          rider_id: input.riderId,
          community_id: input.communityId,
        },
        { onConflict: 'rider_id,community_id' },
      );

      if (error) {
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'rider.assign_community',
        entityType: 'rider',
        entityId: input.riderId,
        after: { communityId: input.communityId },
      });

      return { success: true };
    }),

  unassignCommunity: adminProcedure
    .input(z.object({
      riderId: z.string().uuid(),
      communityId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('rider_communities')
        .delete()
        .eq('rider_id', input.riderId)
        .eq('community_id', input.communityId);

      if (error) {
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'rider.unassign_community',
        entityType: 'rider',
        entityId: input.riderId,
        after: { communityId: input.communityId },
      });

      return { success: true };
    }),

  updateLocation: adminProcedure
    .input(z.object({
      riderId: z.string().uuid(),
      lat: z.number(),
      lng: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase
        .from('riders')
        .update({ current_lat: input.lat, current_lng: input.lng })
        .eq('id', input.riderId);

      return { success: true };
    }),
});
