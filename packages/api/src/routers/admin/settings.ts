import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, superAdminProcedure, router } from '../../trpc/init';

const pricingScopeSchema = z.enum(['all', 'city', 'community', 'user']);

const pricingAudienceFields = z
  .object({
    scope: pricingScopeSchema,
    city: z.string().min(1).optional().nullable(),
    communityId: z.string().uuid().optional().nullable(),
    userId: z.string().uuid().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === 'all') {
      if (val.city || val.communityId || val.userId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'All-scope rules must not set city, community, or user',
        });
      }
    } else if (val.scope === 'city') {
      if (!val.city?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'City is required for city-scope rules',
          path: ['city'],
        });
      }
    } else if (val.scope === 'community') {
      if (!val.communityId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Community is required for community-scope rules',
          path: ['communityId'],
        });
      }
    } else if (val.scope === 'user') {
      if (!val.userId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'User is required for user-scope rules',
          path: ['userId'],
        });
      }
    }
  });

function audienceColumns(input: z.infer<typeof pricingAudienceFields>) {
  return {
    scope: input.scope,
    city: input.scope === 'city' ? input.city!.trim() : null,
    community_id: input.scope === 'community' ? input.communityId! : null,
    user_id: input.scope === 'user' ? input.userId! : null,
  };
}

export const settingsRouter = router({
  updateSetting: adminProcedure
    .input(z.object({
      key: z.string().min(1),
      value: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('system_settings').upsert({
        key: input.key,
        value: input.value,
        updated_by: ctx.userId,
        updated_at: new Date().toISOString(),
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'settings.update',
        entityType: 'system_settings',
        after: { key: input.key },
      });

      return { success: true };
    }),

  createPricing: adminProcedure
    .input(
      pricingAudienceFields.extend({
        serviceId: z.string().uuid(),
        basePrice: z.number().positive(),
        expressMultiplier: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('pricing_rules')
        .insert({
          service_id: input.serviceId,
          base_price: input.basePrice,
          express_multiplier: input.expressMultiplier ?? 1.5,
          ...audienceColumns(input),
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'pricing.create',
        entityType: 'pricing_rules',
        entityId: data.id,
        after: { serviceId: input.serviceId, scope: input.scope },
      });

      return { id: data.id };
    }),

  updatePricing: adminProcedure
    .input(
      pricingAudienceFields.extend({
        id: z.string().uuid(),
        serviceId: z.string().uuid(),
        basePrice: z.number().positive(),
        expressMultiplier: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('pricing_rules')
        .update({
          service_id: input.serviceId,
          base_price: input.basePrice,
          ...(input.expressMultiplier !== undefined
            ? { express_multiplier: input.expressMultiplier }
            : {}),
          ...audienceColumns(input),
        })
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'pricing.update',
        entityType: 'pricing_rules',
        entityId: input.id,
        after: { serviceId: input.serviceId, scope: input.scope },
      });

      return { success: true };
    }),

  deletePricing: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('pricing_rules')
        .delete()
        .eq('id', input.id);

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'pricing.delete',
        entityType: 'pricing_rules',
        entityId: input.id,
      });

      return { success: true };
    }),

  setPermission: superAdminProcedure
    .input(z.object({
      role: z.enum([
        'customer', 'rider', 'warehouse_staff', 'support_agent',
        'community_admin', 'ops_admin', 'super_admin',
      ]),
      resource: z.string(),
      action: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.supabase.from('role_permissions').upsert({
        role: input.role,
        resource: input.resource,
        action: input.action,
      });

      return { success: true };
    }),
});
