import { ordersRouter } from './routers/admin/orders';
import { walletRouter } from './routers/admin/wallet';
import { partnersRouter } from './routers/admin/partners';
import { ridersRouter } from './routers/admin/riders';
import { promotionsRouter } from './routers/admin/promotions';
import { settingsRouter } from './routers/admin/settings';
import { financeRouter } from './routers/admin/finance';
import { communitiesRouter } from './routers/admin/communities';
import { customersRouter } from './routers/admin/customers';
import { supportRouter } from './routers/admin/support';
import { boxesRouter } from './routers/admin/boxes';
import { router } from './trpc/init';

export const appRouter = router({
  orders: ordersRouter,
  wallet: walletRouter,
  partners: partnersRouter,
  riders: ridersRouter,
  promotions: promotionsRouter,
  settings: settingsRouter,
  finance: financeRouter,
  communities: communitiesRouter,
  customers: customersRouter,
  support: supportRouter,
  boxes: boxesRouter,
});

export type AppRouter = typeof appRouter;
