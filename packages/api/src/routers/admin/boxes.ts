import { z } from 'zod';

import { createBoxService } from '@ironcloud/db';

import { writeAuditLog } from '../../lib/audit';
import { adminProcedure, router } from '../../trpc/init';

export const boxesRouter = router({
  create: adminProcedure
    .input(
      z.object({
        boxCode: z.string().min(1).max(32),
        communityId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const boxes = createBoxService(ctx.supabase);
      const data = await boxes.createBox({
        boxCode: input.boxCode,
        communityId: input.communityId,
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'box.create',
        entityType: 'box',
        entityId: data.id,
        after: { boxCode: data.box_code, communityId: input.communityId },
      });

      return { id: data.id, boxCode: data.box_code };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        boxCode: z.string().min(1).max(32).optional(),
        communityId: z.string().uuid().optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const boxes = createBoxService(ctx.supabase);
      await boxes.updateBox({
        id: input.id,
        boxCode: input.boxCode,
        communityId: input.communityId,
        isActive: input.isActive,
      });

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'box.update',
        entityType: 'box',
        entityId: input.id,
        after: {
          boxCode: input.boxCode,
          communityId: input.communityId,
          isActive: input.isActive,
        },
      });

      return { id: input.id };
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const boxes = createBoxService(ctx.supabase);
      await boxes.deactivateBox(input.id);

      await writeAuditLog({
        supabase: ctx.supabase,
        actorId: ctx.userId,
        action: 'box.deactivate',
        entityType: 'box',
        entityId: input.id,
      });

      return { id: input.id };
    }),
});
