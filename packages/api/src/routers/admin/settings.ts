import { z } from 'zod';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, superAdminProcedure, router } from '../../trpc/init';

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

  updatePricing: adminProcedure
    .input(z.object({
      serviceId: z.string().uuid(),
      communityId: z.string().uuid().optional(),
      basePrice: z.number().positive(),
      expressMultiplier: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('pricing_rules')
        .insert({
          service_id: input.serviceId,
          community_id: input.communityId ?? null,
          base_price: input.basePrice,
          express_multiplier: input.expressMultiplier ?? 1.5,
        })
        .select('id')
        .single();

      if (error) throw new Error(error.message);

      return { id: data.id };
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
