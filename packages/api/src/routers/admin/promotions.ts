import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

export const promotionsRouter = router({
  createCoupon: adminProcedure
    .input(z.object({
      code: z.string().min(1),
      discountType: z.enum(['flat', 'percentage']),
      discountValue: z.number().positive(),
      maxDiscount: z.number().positive().optional(),
      usageLimit: z.number().int().positive().optional(),
      validFrom: z.string().datetime().optional(),
      validTo: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('coupons')
        .insert({
          code: input.code.toUpperCase(),
          discount_type: input.discountType,
          discount_value: input.discountValue,
          max_discount: input.maxDiscount ?? null,
          usage_limit: input.usageLimit ?? null,
          valid_from: input.validFrom ?? null,
          valid_to: input.validTo ?? null,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'coupon.create',
        entityType: 'coupon',
        entityId: data.id,
        after: { code: input.code },
      });

      return { id: data.id };
    }),

  updateCoupon: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      code: z.string().min(1),
      discountType: z.enum(['flat', 'percentage']),
      discountValue: z.number().positive(),
      maxDiscount: z.number().positive().optional().nullable(),
      usageLimit: z.number().int().positive().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        code: input.code.toUpperCase(),
        discount_type: input.discountType,
        discount_value: input.discountValue,
        max_discount: input.maxDiscount ?? null,
        usage_limit: input.usageLimit ?? null,
      };

      const { error } = await ctx.supabase.from('coupons').update(updates).eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'coupon.update',
        entityType: 'coupon',
        entityId: input.id,
        after: updates,
      });

      return { success: true };
    }),

  deleteCoupon: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('coupons').delete().eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'coupon.delete',
        entityType: 'coupon',
        entityId: input.id,
      });

      return { success: true };
    }),

  createCampaign: adminProcedure
    .input(z.object({
      name: z.string().min(1),
      type: z.string(),
      channel: z.enum(['push', 'sms', 'whatsapp', 'email', 'in_app']),
      target: z.record(z.unknown()).optional(),
      payload: z.record(z.unknown()).optional(),
      scheduledAt: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('campaigns')
        .insert({
          name: input.name,
          type: input.type,
          channel: input.channel,
          target: input.target ?? {},
          payload: input.payload ?? {},
          scheduled_at: input.scheduledAt ?? null,
          status: input.scheduledAt ? 'scheduled' : 'draft',
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      return { id: data.id };
    }),

  updateCampaign: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      type: z.string().min(1),
      channel: z.enum(['push', 'sms', 'whatsapp', 'email', 'in_app']),
      status: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        name: input.name.trim(),
        type: input.type.trim(),
        channel: input.channel,
        ...(input.status ? { status: input.status } : {}),
      };

      const { error } = await ctx.supabase.from('campaigns').update(updates).eq('id', input.id);
      if (error) throw new Error(error.message);

      return { success: true };
    }),

  deleteCampaign: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('campaigns').delete().eq('id', input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  createBanner: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      imageUrl: z.string().url().optional(),
      link: z.string().optional(),
      position: z.string().optional(),
      communityIds: z.array(z.string().uuid()).optional(),
      activeFrom: z.string().datetime().optional(),
      activeTo: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('banners')
        .insert({
          title: input.title,
          image_url: input.imageUrl ?? null,
          link: input.link ?? null,
          position: input.position ?? 'home',
          community_ids: input.communityIds ?? null,
          active_from: input.activeFrom ?? null,
          active_to: input.activeTo ?? null,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      return { id: data.id };
    }),

  updateBanner: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1),
      position: z.string().optional(),
      link: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        title: input.title.trim(),
        position: input.position?.trim() || 'home',
        link: input.link?.trim() || null,
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      };

      const { error } = await ctx.supabase.from('banners').update(updates).eq('id', input.id);
      if (error) throw new Error(error.message);

      return { success: true };
    }),

  deleteBanner: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from('banners').delete().eq('id', input.id);
      if (error) throw new Error(error.message);
      return { success: true };
    }),
});
