import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { z } from 'zod';

import { createServiceClient } from '@ironcloud/db';
import type { TypedSupabaseClient, UserRole } from '@ironcloud/db';

export type TrpcContext = {
  supabase: TypedSupabaseClient;
  userId: string | null;
  userRole: UserRole | null;
};

const ADMIN_ROLES: UserRole[] = ['ops_admin', 'super_admin'];

export const createContext = async (opts: {
  userId: string | null;
  userRole: UserRole | null;
}): Promise<TrpcContext> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  const supabase = createServiceClient(url, serviceKey);

  return {
    supabase,
    userId: opts.userId,
    userRole: opts.userRole,
  };
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || !ctx.userRole || !ADMIN_ROLES.includes(ctx.userRole)) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Admin access required' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      userRole: ctx.userRole,
    },
  });
});

export const superAdminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId || ctx.userRole !== 'super_admin') {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Super admin access required' });
  }
  return next({ ctx });
});

export { z };
