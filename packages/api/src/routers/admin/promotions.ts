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
    .input(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        channel: z.enum(['push', 'sms', 'whatsapp', 'email', 'in_app']),
        title: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        path: z.string().optional().nullable(),
        communityIds: z.array(z.string().uuid()).optional().nullable(),
        cities: z.array(z.string().min(1)).optional().nullable(),
        userIds: z.array(z.string().uuid()).optional().nullable(),
        scheduledAt: z.string().datetime().optional().nullable(),
        schedule: z
          .object({
            frequency: z.enum(['once', 'daily', 'weekly']),
            time: z.string().regex(/^\d{1,2}:\d{2}$/),
            days: z.array(z.number().int().min(0).max(6)).optional().nullable(),
            once_date: z.string().optional().nullable(),
            timezone: z.string().optional(),
          })
          .optional()
          .nullable(),
        status: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scheduledAt = input.scheduledAt ?? null;
      const schedule = input.schedule ?? null;
      const status =
        input.status?.trim() ||
        (scheduledAt ? 'scheduled' : 'draft');

      const target = {
        community_ids:
          input.communityIds && input.communityIds.length > 0
            ? input.communityIds
            : null,
        cities:
          input.cities && input.cities.length > 0
            ? input.cities.map((c) => c.trim()).filter(Boolean)
            : null,
        user_ids:
          input.userIds && input.userIds.length > 0 ? input.userIds : null,
      };

      const payload = {
        title: (input.title ?? input.name).trim(),
        body: (input.body ?? '').trim(),
        path: input.path?.trim() || null,
      };

      if (input.channel === 'push' && !payload.body) {
        throw new Error('Push message body is required');
      }

      const { data, error } = await ctx.supabase
        .from('campaigns')
        .insert({
          name: input.name.trim(),
          type: input.type.trim(),
          channel: input.channel,
          target,
          payload,
          scheduled_at: scheduledAt,
          schedule,
          status,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'campaign.create',
        entityType: 'campaign',
        entityId: data.id,
        after: { name: input.name, channel: input.channel, status },
      });

      return { id: data.id };
    }),

  updateCampaign: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        type: z.string().min(1),
        channel: z.enum(['push', 'sms', 'whatsapp', 'email', 'in_app']),
        title: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        path: z.string().optional().nullable(),
        communityIds: z.array(z.string().uuid()).optional().nullable(),
        cities: z.array(z.string().min(1)).optional().nullable(),
        userIds: z.array(z.string().uuid()).optional().nullable(),
        scheduledAt: z.string().datetime().optional().nullable(),
        schedule: z
          .object({
            frequency: z.enum(['once', 'daily', 'weekly']),
            time: z.string().regex(/^\d{1,2}:\d{2}$/),
            days: z.array(z.number().int().min(0).max(6)).optional().nullable(),
            once_date: z.string().optional().nullable(),
            timezone: z.string().optional(),
          })
          .optional()
          .nullable(),
        status: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scheduledAt =
        input.scheduledAt === undefined ? undefined : input.scheduledAt;
      const status = input.status?.trim();

      const target = {
        community_ids:
          input.communityIds && input.communityIds.length > 0
            ? input.communityIds
            : null,
        cities:
          input.cities && input.cities.length > 0
            ? input.cities.map((c) => c.trim()).filter(Boolean)
            : null,
        user_ids:
          input.userIds && input.userIds.length > 0 ? input.userIds : null,
      };

      const payload = {
        title: (input.title ?? input.name).trim(),
        body: (input.body ?? '').trim(),
        path: input.path?.trim() || null,
      };

      if (input.channel === 'push' && !payload.body) {
        throw new Error('Push message body is required');
      }

      const updates: Record<string, unknown> = {
        name: input.name.trim(),
        type: input.type.trim(),
        channel: input.channel,
        target,
        payload,
      };

      if (scheduledAt !== undefined) {
        updates.scheduled_at = scheduledAt;
      }
      if (input.schedule !== undefined) {
        updates.schedule = input.schedule;
      }
      if (status) {
        updates.status = status;
      } else if (scheduledAt) {
        updates.status = 'scheduled';
      }

      const { error } = await ctx.supabase
        .from('campaigns')
        .update(updates)
        .eq('id', input.id);
      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'campaign.update',
        entityType: 'campaign',
        entityId: input.id,
        after: updates,
      });

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
      communityIds: z.array(z.string().uuid()).optional().nullable(),
      cities: z.array(z.string().min(1)).optional().nullable(),
      userIds: z.array(z.string().uuid()).optional().nullable(),
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
          community_ids:
            input.communityIds && input.communityIds.length > 0
              ? input.communityIds
              : null,
          cities:
            input.cities && input.cities.length > 0 ? input.cities : null,
          user_ids:
            input.userIds && input.userIds.length > 0 ? input.userIds : null,
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
      communityIds: z.array(z.string().uuid()).nullable().optional(),
      cities: z.array(z.string().min(1)).nullable().optional(),
      userIds: z.array(z.string().uuid()).nullable().optional(),
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
        ...(input.communityIds !== undefined
          ? {
              community_ids:
                input.communityIds && input.communityIds.length > 0
                  ? input.communityIds
                  : null,
            }
          : {}),
        ...(input.cities !== undefined
          ? {
              cities:
                input.cities && input.cities.length > 0 ? input.cities : null,
            }
          : {}),
        ...(input.userIds !== undefined
          ? {
              user_ids:
                input.userIds && input.userIds.length > 0
                  ? input.userIds
                  : null,
            }
          : {}),
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
