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
  CommunityStage,
} from './types';

export {
  DEFAULT_GARMENT_CATEGORIES,
  PRICING_SCOPE_RANK,
  SERVICE_LINES,
  filterCatalogItems,
  formatReadyIn,
  formatServiceDisplayName,
  formatServiceOptionLabel,
  listGarmentCategoryTabs,
  listServiceLineChoices,
  listUsedServiceLines,
  normalizeEstimatedDays,
  normalizeGarmentCategory,
  normalizeServiceLine,
  pickBestUnitPrices,
  pricingRuleMatchesAudience,
  resolveCatalogBrowse,
  serviceLineLabel,
  type CatalogBrowseFields,
  type PricingAudienceContext,
  type PricingRuleCandidate,
  type PricingScope,
  type ResolvedUnitPrice,
} from './pricing';

export {
  MAX_KG_QUANTITY,
  MAX_PIECE_QUANTITY,
  assertServiceQuantities,
  clampServiceQuantity,
  isWeightService,
  maxQuantityForService,
  serviceQuantityError,
} from './quantity-limits';

export {
  createBoxService,
  type BoxService,
  type BoxScanMode,
  type BoxScanResult,
  type BoxListFilters,
  type OrderBoxRow,
} from './queries/boxes/box.service';
