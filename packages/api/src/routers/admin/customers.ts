import { persistBenefitClaimsForUser } from '../../lib/benefit-identity';
import { writeAuditLog } from '../../lib/audit';
import { createStubProfileUser } from '../../lib/createStubProfile';
import { adminProcedure, router, z } from '../../trpc/init';

const digitsOnly = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export const customersRouter = router({
  create: adminProcedure
    .input(z.object({
      fullName: z.string().min(1),
      phone: z.string().min(10),
      email: z.union([z.string().email(), z.literal('')]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id } = await createStubProfileUser(ctx.supabase, {
        fullName: input.fullName,
        phone: input.phone,
        role: 'customer',
        email: input.email ? input.email : null,
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'customer.create',
        entityType: 'customer',
        entityId: id,
        after: { fullName: input.fullName, phone: input.phone },
      });

      return { id };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.string().uuid(),
      fullName: z.string().min(1),
      phone: z.string().min(10),
      email: z.union([z.string().email(), z.literal('')]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const phone = digitsOnly(input.phone);
      if (phone.length !== 10) throw new Error('Phone must be a 10-digit mobile number');

      const { data: conflict } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .neq('id', input.id)
        .maybeSingle();

      if (conflict) throw new Error('A profile with this phone number already exists');

      const updates = {
        full_name: input.fullName.trim(),
        phone,
        email: input.email?.trim() || null,
      };

      const { error } = await ctx.supabase
        .from('profiles')
        .update(updates)
        .eq('id', input.id)
        .eq('role', 'customer');

      if (error) {
        if (error.code === '23505') throw new Error('A profile with this phone number already exists');
        throw new Error(error.message);
      }

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'customer.update',
        entityType: 'customer',
        entityId: input.id,
        after: updates,
      });

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('id, role, phone')
        .eq('id', input.id)
        .eq('role', 'customer')
        .maybeSingle();

      if (!profile) throw new Error('Customer not found');

      await persistBenefitClaimsForUser(
        ctx.supabase,
        input.id,
        (profile as { phone: string | null }).phone,
      );

      const { error: profileError } = await ctx.supabase
        .from('profiles')
        .delete()
        .eq('id', input.id);

      if (profileError) throw new Error(profileError.message);

      await ctx.supabase.auth.admin.deleteUser(input.id).catch(() => undefined);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'customer.delete',
        entityType: 'customer',
        entityId: input.id,
      });

      return { success: true };
    }),
});
