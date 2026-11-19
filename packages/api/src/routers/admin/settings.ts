import { z } from 'zod';

import {
  normalizeGarmentCategory,
  normalizeServiceLine,
  type TypedSupabaseClient,
} from '@ironcloud/db';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, superAdminProcedure, router } from '../../trpc/init';

const pricingScopeSchema = z.enum(['all', 'city', 'community', 'user']);

const pricingAudienceObject = z.object({
  scope: pricingScopeSchema,
  city: z.string().min(1).optional().nullable(),
  communityId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

type PricingAudience = z.infer<typeof pricingAudienceObject>;

function refinePricingAudience(
  val: PricingAudience,
  ctx: z.RefinementCtx,
) {
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
}

function audienceColumns(input: PricingAudience) {
  return {
    scope: input.scope,
    city: input.scope === 'city' ? input.city!.trim() : null,
    community_id: input.scope === 'community' ? input.communityId! : null,
    user_id: input.scope === 'user' ? input.userId! : null,
  };
}

const pricingServiceObject = z.object({
  serviceId: z.string().uuid().optional().nullable(),
  newServiceName: z.string().optional().nullable(),
  serviceName: z.string().optional().nullable(),
  garmentCategory: z.string().min(1),
  serviceLine: z.string().min(1).optional(),
  basePrice: z.number().positive(),
  discountPrice: z.number().nullable().optional(),
  estimatedDays: z.number().int().min(1).max(60).nullable().optional(),
  expressMultiplier: z.number().positive().optional(),
});

type PricingServiceInput = z.infer<typeof pricingServiceObject>;

function refinePricingService(val: PricingServiceInput, ctx: z.RefinementCtx) {
  const hasId = Boolean(val.serviceId);
  const hasName = Boolean(val.newServiceName?.trim());
  if (!hasId && !hasName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select a service or enter a new service name',
      path: ['serviceId'],
    });
  }
  if (!val.garmentCategory?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select a category',
      path: ['garmentCategory'],
    });
  }
  const discount = val.discountPrice;
  if (discount == null || discount === 0) return;
  if (!Number.isFinite(discount) || discount < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid discount price',
      path: ['discountPrice'],
    });
    return;
  }
  if (discount >= val.basePrice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Discount price must be lower than the base price',
      path: ['discountPrice'],
    });
  }
}

function storedDiscountPrice(discountPrice: number | null | undefined): number | null {
  if (discountPrice == null || discountPrice === 0) return null;
  return discountPrice;
}

function storedEstimatedDays(estimatedDays: number | null | undefined): number | null {
  if (estimatedDays == null) return null;
  return estimatedDays;
}

function requireServiceName(value: string): string {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Enter a service name');
  if (name.length > 80) throw new Error('Service name is too long');
  return name;
}

function requireGarmentCategory(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  if (!trimmed) throw new Error('Select target people');
  const category = normalizeGarmentCategory(trimmed);
  if (category.length > 40) throw new Error('Target people name is too long');
  return category;
}

function requireServiceLine(value: string | null | undefined): string {
  return normalizeServiceLine(value);
}

function sameServiceIdentity(
  row: { name: string; garment_category?: string | null; category?: string | null },
  name: string,
  garmentCategory: string,
  serviceLine: string,
) {
  return (
    row.name.trim().toLowerCase() === name.trim().toLowerCase() &&
    normalizeGarmentCategory(row.garment_category) === garmentCategory &&
    normalizeServiceLine(row.category) === serviceLine
  );
}

async function listActiveServices(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, garment_category, category')
    .eq('is_active', true)
    .limit(500);

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function nextServiceSortOrder(supabase: TypedSupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('services')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const current = data?.[0]?.sort_order;
  return (typeof current === 'number' ? current : -1) + 1;
}

/** Keep services outside `orderedIds` in place, and write that subset in the new order. */
function mergeServiceOrder(currentIds: string[], orderedIds: string[]): string[] {
  const wanted = new Set(orderedIds);
  const positions: number[] = [];
  currentIds.forEach((id, index) => {
    if (wanted.has(id)) positions.push(index);
  });
  const next = [...currentIds];
  orderedIds.forEach((id, index) => {
    const slot = positions[index];
    if (slot !== undefined) next[slot] = id;
  });
  return next;
}

async function assertServiceIdentityAvailable(
  supabase: TypedSupabaseClient,
  name: string,
  garmentCategory: string,
  serviceLine: string,
  exceptId?: string,
) {
  const active = await listActiveServices(supabase);
  const clash = active.find(
    (row) =>
      row.id !== exceptId &&
      sameServiceIdentity(row, name, garmentCategory, serviceLine),
  );
  if (clash) {
    throw new Error(
      'That garment already exists for this target people and service type',
    );
  }
}

async function insertGarmentService(
  supabase: TypedSupabaseClient,
  name: string,
  garmentCategory: string,
  serviceLine: string,
): Promise<string> {
  await assertServiceIdentityAvailable(supabase, name, garmentCategory, serviceLine);

  const { data, error } = await supabase
    .from('services')
    .insert({
      name,
      category: serviceLine,
      garment_category: garmentCategory,
      unit: 'piece',
      sort_order: await nextServiceSortOrder(supabase),
      is_active: true,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      throw new Error(
        'That garment already exists for this target people and service type',
      );
    }
    throw new Error(error.message);
  }
  if (!data?.id) throw new Error('Failed to create service');
  return data.id;
}

async function updateServiceDetails(
  supabase: TypedSupabaseClient,
  serviceId: string,
  name: string | null,
  garmentCategory: string,
  serviceLine: string,
) {
  const active = await listActiveServices(supabase);
  const current = active.find((row) => row.id === serviceId);
  const nextName = name ?? current?.name ?? '';
  if (!nextName.trim()) throw new Error('Enter a service name');
  await assertServiceIdentityAvailable(
    supabase,
    nextName,
    garmentCategory,
    serviceLine,
    serviceId,
  );

  const { error } = await supabase
    .from('services')
    .update({
      garment_category: garmentCategory,
      category: serviceLine,
      ...(name ? { name } : {}),
    })
    .eq('id', serviceId);
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      throw new Error(
        'That garment already exists for this target people and service type',
      );
    }
    throw new Error(error.message);
  }
}

async function ensureGarmentCategory(
  supabase: TypedSupabaseClient,
  name: string,
) {
  const existing = await supabase
    .from('garment_categories')
    .select('name')
    .eq('name', name)
    .maybeSingle();

  if (existing.error) {
    if (/garment_categories/i.test(existing.error.message)) return;
    throw new Error(existing.error.message);
  }
  if (existing.data) return;

  const last = await supabase
    .from('garment_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last.error) throw new Error(last.error.message);
  const next = (last.data?.sort_order ?? -1) + 1;
  const inserted = await supabase
    .from('garment_categories')
    .insert({ name, sort_order: next });

  if (inserted.error && !/duplicate|unique/i.test(inserted.error.message)) {
    throw new Error(inserted.error.message);
  }
}

async function resolveServiceId(
  supabase: TypedSupabaseClient,
  input: Pick<
    PricingServiceInput,
    'serviceId' | 'newServiceName' | 'serviceName' | 'garmentCategory' | 'serviceLine'
  >,
  mode: 'create' | 'update',
): Promise<string> {
  const garmentCategory = requireGarmentCategory(input.garmentCategory);
  const serviceLine = requireServiceLine(input.serviceLine);
  await ensureGarmentCategory(supabase, garmentCategory);
  const newName = input.newServiceName?.trim();

  if (newName) {
    const name = requireServiceName(newName);
    const active = await listActiveServices(supabase);
    const existing = active.find((row) =>
      sameServiceIdentity(row, name, garmentCategory, serviceLine),
    );
    if (existing) return existing.id;
    return insertGarmentService(supabase, name, garmentCategory, serviceLine);
  }

  if (!input.serviceId) throw new Error('Service is required');

  const rename = input.serviceName?.trim()
    ? requireServiceName(input.serviceName)
    : null;

  if (mode === 'create') {
    const active = await listActiveServices(supabase);
    const current = active.find((row) => row.id === input.serviceId);
    const nextName = rename ?? current?.name ?? '';
    if (!nextName.trim()) throw new Error('Enter a service name');
    if (
      current &&
      !sameServiceIdentity(current, nextName, garmentCategory, serviceLine)
    ) {
      return insertGarmentService(supabase, nextName, garmentCategory, serviceLine);
    }
    return input.serviceId;
  }

  await updateServiceDetails(
    supabase,
    input.serviceId,
    rename,
    garmentCategory,
    serviceLine,
  );
  return input.serviceId;
}

const createPricingInput = pricingAudienceObject
  .merge(pricingServiceObject)
  .superRefine((val, ctx) => {
    refinePricingAudience(val, ctx);
    refinePricingService(val, ctx);
  });

const updatePricingInput = pricingAudienceObject
  .merge(pricingServiceObject)
  .extend({
    id: z.string().uuid(),
  })
  .superRefine((val, ctx) => {
    refinePricingAudience(val, ctx);
    refinePricingService(val, ctx);
  });

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
    .input(createPricingInput)
    .mutation(async ({ ctx, input }) => {
      const serviceId = await resolveServiceId(ctx.supabase, input, 'create');

      const { data, error } = await ctx.supabase
        .from('pricing_rules')
        .insert({
          service_id: serviceId,
          base_price: input.basePrice,
          discount_price: storedDiscountPrice(input.discountPrice),
          estimated_days: storedEstimatedDays(input.estimatedDays),
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
        after: {
          serviceId,
          newServiceName: input.newServiceName?.trim() || null,
          serviceName: input.serviceName?.trim() || null,
          garmentCategory: normalizeGarmentCategory(input.garmentCategory),
          serviceLine: normalizeServiceLine(input.serviceLine),
          scope: input.scope,
          discountPrice: storedDiscountPrice(input.discountPrice),
          estimatedDays: storedEstimatedDays(input.estimatedDays),
        },
      });

      return { id: data.id };
    }),

  updatePricing: adminProcedure
    .input(updatePricingInput)
    .mutation(async ({ ctx, input }) => {
      const serviceId = await resolveServiceId(ctx.supabase, input, 'update');

      const { error } = await ctx.supabase
        .from('pricing_rules')
        .update({
          service_id: serviceId,
          base_price: input.basePrice,
          discount_price: storedDiscountPrice(input.discountPrice),
          estimated_days: storedEstimatedDays(input.estimatedDays),
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
        after: {
          serviceId,
          newServiceName: input.newServiceName?.trim() || null,
          serviceName: input.serviceName?.trim() || null,
          garmentCategory: normalizeGarmentCategory(input.garmentCategory),
          serviceLine: normalizeServiceLine(input.serviceLine),
          scope: input.scope,
          discountPrice: storedDiscountPrice(input.discountPrice),
          estimatedDays: storedEstimatedDays(input.estimatedDays),
        },
      });

      return { success: true };
    }),

  reorderServices: adminProcedure
    .input(z.object({
      orderedIds: z.array(z.string().uuid()).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const unique = new Set(input.orderedIds);
      if (unique.size !== input.orderedIds.length) {
        throw new Error('Duplicate services in order');
      }

      const { data, error } = await ctx.supabase
        .from('services')
        .select('id, name, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
        .limit(500);

      if (error) throw new Error(error.message);

      const rows = data ?? [];
      const known = new Set(rows.map((row) => row.id));
      for (const id of input.orderedIds) {
        if (!known.has(id)) throw new Error('Unknown service in order');
      }

      const next = mergeServiceOrder(rows.map((row) => row.id), input.orderedIds);
      for (let index = 0; index < next.length; index += 1) {
        const id = next[index];
        const existing = rows.find((row) => row.id === id);
        if (existing?.sort_order === index) continue;
        const { error: updateError } = await ctx.supabase
          .from('services')
          .update({ sort_order: index })
          .eq('id', id);
        if (updateError) throw new Error(updateError.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'pricing.reorder',
        entityType: 'services',
        after: { orderedIds: input.orderedIds },
      });

      return { success: true };
    }),

  reorderGarmentCategories: adminProcedure
    .input(z.object({
      orderedNames: z.array(z.string().trim().min(1).max(40)).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const names = input.orderedNames.map((name) => requireGarmentCategory(name));
      if (new Set(names).size !== names.length) {
        throw new Error('Duplicate categories in order');
      }

      const { data, error } = await ctx.supabase
        .from('garment_categories')
        .select('name, sort_order')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);

      const current: string[] = [];
      const seen = new Set<string>();
      for (const row of data ?? []) {
        const name = normalizeGarmentCategory(row.name);
        if (seen.has(name)) continue;
        seen.add(name);
        current.push(name);
      }

      const ordered = new Set(names);
      const next = [...names, ...current.filter((name) => !ordered.has(name))];
      for (let index = 0; index < next.length; index += 1) {
        const name = next[index];
        if (!name) continue;
        const existing = (data ?? []).find((row) => row.name === name);
        if (existing?.sort_order === index) continue;
        const { error: writeError } = await ctx.supabase
          .from('garment_categories')
          .upsert({ name, sort_order: index }, { onConflict: 'name' });
        if (writeError) throw new Error(writeError.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'pricing.reorder_categories',
        entityType: 'garment_categories',
        after: { orderedNames: names },
      });

      return { success: true };
    }),

  updateAppVersionPolicy: adminProcedure
    .input(z.object({
      platform: z.enum(['ios', 'android']),
      minVersion: z
        .string()
        .trim()
        .regex(/^\d+(\.\d+){0,2}$/, 'Use a version like 1.2.0'),
      storeUrl: z
        .string()
        .trim()
        .url('Store URL must start with http or https')
        .refine((value) => {
          const protocol = new URL(value).protocol;
          return protocol === 'http:' || protocol === 'https:';
        }, 'Store URL must start with http or https'),
      title: z.string().trim().max(120),
      message: z.string().trim().min(1, 'Message is required').max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing, error: readError } = await ctx.supabase
        .from('app_version_policy')
        .select('platform, min_version, store_url, title, message')
        .eq('platform', input.platform)
        .maybeSingle();

      if (readError) throw new Error(readError.message);
      if (!existing) throw new Error('No version policy for this platform');

      const title = input.title || 'Update required';
      const { data, error } = await ctx.supabase
        .from('app_version_policy')
        .update({
          min_version: input.minVersion,
          store_url: input.storeUrl,
          title,
          message: input.message,
          updated_at: new Date().toISOString(),
        })
        .eq('platform', input.platform)
        .select('platform, min_version, store_url, title, message, updated_at')
        .single();

      if (error) throw new Error(error.message);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'app_version_policy.update',
        entityType: 'app_version_policy',
        before: {
          platform: existing.platform,
          min_version: existing.min_version,
          store_url: existing.store_url,
          title: existing.title,
          message: existing.message,
        },
        after: {
          platform: data.platform,
          min_version: data.min_version,
          store_url: data.store_url,
          title: data.title,
          message: data.message,
        },
      });

      return data;
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
