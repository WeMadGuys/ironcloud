export {
  createSupabaseClient,
  createServiceClient,
  getSupabaseClient,
  type TypedSupabaseClient,
} from './client';

export type {
  Database,
  Tables,
  InsertTables,
  UpdateTables,
  Enums,
  Json,
  UserRole,
  OrderStatus,
  JobType,
  JobStatus,
  WalletTxnType,
  NotificationChannel,
  TicketStatus,
  SlotType,
  PaymentMethod,
  BoxStatus,
  BoxEventType,
} from './types';

export {
  PRICING_SCOPE_RANK,
  pickBestUnitPrices,
  pricingRuleMatchesAudience,
  type PricingAudienceContext,
  type PricingRuleCandidate,
  type PricingScope,
} from './pricing';

export {
  createBoxService,
  type BoxService,
  type BoxScanMode,
  type BoxScanResult,
  type BoxListFilters,
  type OrderBoxRow,
} from './queries/boxes/box.service';
