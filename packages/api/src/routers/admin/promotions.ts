import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

const couponScope = z.enum(['order', 'wallet_topup']);

const couponFields = {
  code: z.string().min(1),
  discountType: z.enum(['flat', 'percentage']),
  discountValue: z.number().positive(),
  maxDiscount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
  applicableOn: z.array(couponScope).min(1),
  communityIds: z.array(z.string().uuid()).optional().nullable(),
  cities: z.array(z.string().min(1)).optional().nullable(),
  minAmount: z.number().positive().optional().nullable(),
};

export const promotionsRouter = router({
  createCoupon: adminProcedure
    .input(z.object(couponFields))
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
          applicable_on: input.applicableOn,
          community_ids:
            input.communityIds && input.communityIds.length > 0
              ? input.communityIds
              : null,
          cities:
            input.cities && input.cities.length > 0
              ? input.cities.map((c) => c.trim()).filter(Boolean)
              : null,
          min_amount: input.minAmount ?? null,
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
        after: { code: input.code, applicableOn: input.applicableOn },
      });

      return { id: data.id };
    }),

  updateCoupon: adminProcedure
    .input(z.object({ id: z.string().uuid(), ...couponFields }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        code: input.code.toUpperCase(),
        discount_type: input.discountType,
        discount_value: input.discountValue,
        max_discount: input.maxDiscount ?? null,
        usage_limit: input.usageLimit ?? null,
        valid_from: input.validFrom ?? null,
        valid_to: input.validTo ?? null,
        applicable_on: input.applicableOn,
        community_ids:
          input.communityIds && input.communityIds.length > 0
            ? input.communityIds
            : null,
        cities:
          input.cities && input.cities.length > 0
            ? input.cities.map((c) => c.trim()).filter(Boolean)
            : null,
        min_amount: input.minAmount ?? null,
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
      imageUrl: z.string().url().optional().nullable(),
      link: z.string().optional().nullable(),
      position: z.string().optional(),
      maxImpressions: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
      communityIds: z.array(z.string().uuid()).optional(),
      activeFrom: z.string().datetime().optional(),
      activeTo: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('banners')
        .insert({
          title: input.title.trim(),
          image_url: input.imageUrl?.trim() || null,
          link: input.link?.trim() || null,
          position: input.position?.trim() || 'home',
          max_impressions: input.maxImpressions ?? 1,
          is_active: input.isActive ?? true,
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
      imageUrl: z.string().url().optional().nullable(),
      position: z.string().optional(),
      link: z.string().optional().nullable(),
      maxImpressions: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updates = {
        title: input.title.trim(),
        image_url: input.imageUrl?.trim() || null,
        position: input.position?.trim() || 'home',
        link: input.link?.trim() || null,
        ...(input.maxImpressions !== undefined
          ? { max_impressions: input.maxImpressions }
          : {}),
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

  createReferralProgram: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        isActive: z.boolean().optional(),
        referrerRewardAmount: z.number().min(0),
        refereeRewardAmount: z.number().min(0),
        minRefereeTopupAmount: z.number().min(0),
        validFrom: z.string().datetime().optional().nullable(),
        validTo: z.string().datetime().optional().nullable(),
        communityIds: z.array(z.string().uuid()).optional().nullable(),
        cities: z.array(z.string().min(1)).optional().nullable(),
        maxReferralsPerReferrer: z.number().int().positive().optional().nullable(),
        shareMessageTemplate: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('referral_programs')
        .insert({
          name: input.name.trim(),
          is_active: input.isActive ?? true,
          referrer_reward_amount: input.referrerRewardAmount,
          referee_reward_amount: input.refereeRewardAmount,
          min_referee_topup_amount: input.minRefereeTopupAmount,
          valid_from: input.validFrom ?? null,
          valid_to: input.validTo ?? null,
          community_ids:
            input.communityIds && input.communityIds.length > 0
              ? input.communityIds
              : null,
          cities:
            input.cities && input.cities.length > 0
              ? input.cities.map((c) => c.trim()).filter(Boolean)
              : null,
          max_referrals_per_referrer: input.maxReferralsPerReferrer ?? null,
          share_message_template: input.shareMessageTemplate?.trim() || null,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'referral_program.create',
        entityType: 'referral_program',
        entityId: data.id,
        after: { name: input.name },
      });

      return { id: data.id };
    }),

  updateReferralProgram: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        isActive: z.boolean(),
        referrerRewardAmount: z.number().min(0),
        refereeRewardAmount: z.number().min(0),
        minRefereeTopupAmount: z.number().min(0),
        validFrom: z.string().datetime().optional().nullable(),
        validTo: z.string().datetime().optional().nullable(),
        communityIds: z.array(z.string().uuid()).optional().nullable(),
        cities: z.array(z.string().min(1)).optional().nullable(),
        maxReferralsPerReferrer: z.number().int().positive().optional().nullable(),
        shareMessageTemplate: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates = {
        name: input.name.trim(),
        is_active: input.isActive,
        referrer_reward_amount: input.referrerRewardAmount,
        referee_reward_amount: input.refereeRewardAmount,
        min_referee_topup_amount: input.minRefereeTopupAmount,
        valid_from: input.validFrom ?? null,
        valid_to: input.validTo ?? null,
        community_ids:
          input.communityIds && input.communityIds.length > 0
            ? input.communityIds
            : null,
        cities:
          input.cities && input.cities.length > 0
            ? input.cities.map((c) => c.trim()).filter(Boolean)
            : null,
        max_referrals_per_referrer: input.maxReferralsPerReferrer ?? null,
        share_message_template: input.shareMessageTemplate?.trim() || null,
      };

      const { error } = await ctx.supabase
        .from('referral_programs')
        .update(updates)
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'referral_program.update',
        entityType: 'referral_program',
        entityId: input.id,
        after: updates,
      });

      return { success: true };
    }),

  deleteReferralProgram: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('referral_programs')
        .delete()
        .eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'referral_program.delete',
        entityType: 'referral_program',
        entityId: input.id,
      });

      return { success: true };
    }),
});
