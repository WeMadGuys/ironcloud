import { createTRPCReact } from '@trpc/react-query';

import type { AppRouter } from '@ironcloud/api';

export const trpc = createTRPCReact<AppRouter>();
