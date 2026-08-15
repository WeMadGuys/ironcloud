'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  Badge,
  Button,
  EmptyState,
  Loader,
  Pagination,
  Picklist,
  SearchInput,
  Table,
} from '@/components';
import type { OrderStatus, PaymentMethod } from '@ironcloud/db';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { trpc } from '@/lib/trpc';
import {
  formatCurrency,
  formatOrderStatus,
  formatRelativeTime,
  getOrderStatusBadge,
} from '@/utils/format';

import {
  fetchOrders,
  type OrderListColumnFilters,
} from '../services/orders.service';
import {
  dateRangeKey,
  ORDER_DATE_PRESET_OPTIONS,
  resolveOrderDateRange,
  type OrderDatePreset,
} from '../utils/datePresets';

import pageStyles from '@/styles/pages.module.css';
import listStyles from './OrdersListPage.module.css';

const STATUS_OPTIONS: OrderStatus[] = [
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
  'picked_up',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
  'delivery_assigned',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'wallet', label: 'Wallet' },
  { value: 'razorpay_direct', label: 'Razorpay' },
];

type OrderColumnKey =
  | 'order'
  | 'customer'
  | 'phone'
  | 'community'
  | 'address'
  | 'status'
  | 'payment'
  | 'amount'
  | 'pickup'
  | 'delivery'
  | 'rider'
  | 'pickupRider'
  | 'deliveryRider'
  | 'rating'
  | 'feedback'
  | 'instructions'
  | 'booked';

const COLUMN_LABELS: Record<OrderColumnKey, string> = {
  order: 'Order',
  customer: 'Customer',
  phone: 'Phone',
  community: 'Community',
  address: 'Address',
  status: 'Status',
  payment: 'Payment',
  amount: 'Amount',
  pickup: 'Pickup time',
  delivery: 'Delivery time',
  rider: 'Current rider',
  pickupRider: 'Pickup rider',
  deliveryRider: 'Delivery rider',
  rating: 'Rating',
  feedback: 'Feedback',
  instructions: 'Special instructions',
  booked: 'Booked',
};

const DEFAULT_COLUMNS: OrderColumnKey[] = [
  'order',
  'customer',
  'community',
  'status',
  'payment',
  'amount',
  'pickup',
  'delivery',
  'rider',
  'booked',
];

const ALL_COLUMN_KEYS = Object.keys(COLUMN_LABELS) as OrderColumnKey[];

type TextColumnFilters = {
  customer: string;
  phone: string;
  address: string;
  amount: string;
  rider: string;
  pickupRider: string;
  deliveryRider: string;
  rating: string;
  feedback: string;
  instructions: string;
  pickup: string;
  delivery: string;
  booked: string;
};

type GridFilters = {
  search: string;
  status: OrderStatus[];
  communityId: string[];
  paymentMethod: PaymentMethod[];
  datePreset: OrderDatePreset;
  customFrom: string;
  customTo: string;
  columns: TextColumnFilters;
};

type GridPrefs = {
  visibleColumns: OrderColumnKey[];
  draft: GridFilters;
  applied: GridFilters;
  autoApply: boolean;
};

const EMPTY_TEXT_COLUMNS: TextColumnFilters = {
  customer: '',
  phone: '',
  address: '',
  amount: '',
  rider: '',
  pickupRider: '',
  deliveryRider: '',
  rating: '',
  feedback: '',
  instructions: '',
  pickup: '',
  delivery: '',
  booked: '',
};

const DEFAULT_FILTERS: GridFilters = {
  search: '',
  status: [],
  communityId: [],
  paymentMethod: [],
  datePreset: 'today',
  customFrom: '',
  customTo: '',
  columns: EMPTY_TEXT_COLUMNS,
};

const STORAGE_KEY = 'ironcloud_orders_grid';
const LEGACY_COLUMNS_KEY = 'ironcloud_orders_columns';

const DATE_PRESETS = new Set(
  ORDER_DATE_PRESET_OPTIONS.map((o) => o.value),
);

function sanitizeColumns(keys: unknown): OrderColumnKey[] {
  if (!Array.isArray(keys)) return DEFAULT_COLUMNS;
  const allowed = new Set(ALL_COLUMN_KEYS);
  const next = keys.filter((k): k is OrderColumnKey =>
    allowed.has(k as OrderColumnKey),
  );
  return next.length > 0 ? next : DEFAULT_COLUMNS;
}

function sanitizeStatusList(value: unknown): OrderStatus[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(STATUS_OPTIONS);
  return value.filter((v): v is OrderStatus => allowed.has(v as OrderStatus));
}

function sanitizePaymentList(value: unknown): PaymentMethod[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(PAYMENT_OPTIONS.map((p) => p.value));
  return value.filter((v): v is PaymentMethod =>
    allowed.has(v as PaymentMethod),
  );
}

function sanitizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function sanitizeTextColumns(value: unknown): TextColumnFilters {
  const src =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const out = { ...EMPTY_TEXT_COLUMNS };
  for (const key of Object.keys(EMPTY_TEXT_COLUMNS) as (keyof TextColumnFilters)[]) {
    if (typeof src[key] === 'string') out[key] = src[key] as string;
  }
  return out;
}

function sanitizeFilters(value: unknown): GridFilters {
  if (!value || typeof value !== 'object') return { ...DEFAULT_FILTERS, columns: { ...EMPTY_TEXT_COLUMNS } };
  const src = value as Record<string, unknown>;
  const datePreset =
    typeof src.datePreset === 'string' && DATE_PRESETS.has(src.datePreset as OrderDatePreset)
      ? (src.datePreset as OrderDatePreset)
      : 'today';
  return {
    search: typeof src.search === 'string' ? src.search : '',
    status: sanitizeStatusList(src.status),
    communityId: sanitizeStringList(src.communityId),
    paymentMethod: sanitizePaymentList(src.paymentMethod),
    datePreset,
    customFrom: typeof src.customFrom === 'string' ? src.customFrom : '',
    customTo: typeof src.customTo === 'string' ? src.customTo : '',
    columns: sanitizeTextColumns(src.columns),
  };
}

function loadPrefs(): GridPrefs {
  const defaults: GridPrefs = {
    visibleColumns: DEFAULT_COLUMNS,
    draft: { ...DEFAULT_FILTERS, columns: { ...EMPTY_TEXT_COLUMNS } },
    applied: { ...DEFAULT_FILTERS, columns: { ...EMPTY_TEXT_COLUMNS } },
    autoApply: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return {
        visibleColumns: sanitizeColumns(parsed.visibleColumns),
        draft: sanitizeFilters(parsed.draft),
        applied: sanitizeFilters(parsed.applied),
        autoApply: Boolean(parsed.autoApply),
      };
    }
    const legacy = localStorage.getItem(LEGACY_COLUMNS_KEY);
    if (legacy) {
      return {
        ...defaults,
        visibleColumns: sanitizeColumns(JSON.parse(legacy)),
      };
    }
  } catch {
    // ignore
  }
  return defaults;
}

function savePrefs(prefs: GridPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

function filtersEqual(a: GridFilters, b: GridFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hasNonDefaultFilters(f: GridFilters): boolean {
  return (
    f.search.trim().length > 0 ||
    f.status.length > 0 ||
    f.communityId.length > 0 ||
    f.paymentMethod.length > 0 ||
    f.datePreset !== 'today' ||
    f.customFrom.length > 0 ||
    f.customTo.length > 0 ||
    Object.values(f.columns).some((v) => v.trim().length > 0)
  );
}

function toColumnFilters(f: GridFilters): OrderListColumnFilters {
  const c = f.columns;
  return {
    customer: c.customer.trim() || undefined,
    phone: c.phone.trim() || undefined,
    address: c.address.trim() || undefined,
    amount: c.amount.trim() || undefined,
    rider: c.rider.trim() || undefined,
    pickupRider: c.pickupRider.trim() || undefined,
    deliveryRider: c.deliveryRider.trim() || undefined,
    rating: c.rating.trim() || undefined,
    feedback: c.feedback.trim() || undefined,
    instructions: c.instructions.trim() || undefined,
    pickupDate: c.pickup.trim() || undefined,
    deliveryDate: c.delivery.trim() || undefined,
    bookedDate: c.booked.trim() || undefined,
  };
}

type SlotEmbed = { window_start: string; window_end?: string } | null;
type RiderEmbed = {
  id: string;
  profiles: { full_name: string | null; phone: string | null } | null;
} | null;
type RiderJobEmbed = {
  id: string;
  job_type: 'pickup' | 'delivery';
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  riders: RiderEmbed;
};

type OrderRow = Awaited<ReturnType<typeof fetchOrders>>['data'][number];

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatSlotWindow(
  slot: SlotEmbed | SlotEmbed[] | null | undefined,
): string {
  const row = asOne(slot);
  if (!row?.window_start) return '—';
  const start = new Date(row.window_start);
  const end = row.window_end ? new Date(row.window_end) : null;
  const date = start.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };
  const startTime = start.toLocaleTimeString('en-IN', timeOpts);
  if (!end) return `${date} · ${startTime}`;
  const endTime = end.toLocaleTimeString('en-IN', timeOpts);
  return `${date} · ${startTime}–${endTime}`;
}

function getJobs(order: OrderRow): RiderJobEmbed[] {
  const jobs = (order as { rider_jobs?: RiderJobEmbed[] | null }).rider_jobs;
  return Array.isArray(jobs) ? jobs : [];
}

function riderName(job: RiderJobEmbed | undefined): string {
  if (!job?.riders) return '—';
  const rider = asOne(job.riders);
  return rider?.profiles?.full_name?.trim() || '—';
}

function openJob(
  jobs: RiderJobEmbed[],
  type: 'pickup' | 'delivery',
): RiderJobEmbed | undefined {
  const open = jobs.find(
    (j) => j.job_type === type && ['assigned', 'in_progress'].includes(j.status),
  );
  if (open) return open;
  return jobs
    .filter((j) => j.job_type === type)
    .sort((a, b) => a.id.localeCompare(b.id))
    .at(-1);
}

function currentRider(order: OrderRow): string {
  const jobs = getJobs(order);
  const deliveryStages = [
    'ready_for_delivery',
    'delivery_assigned',
    'out_for_delivery',
    'delivered',
    'completed',
    'rated',
  ];
  if (deliveryStages.includes(order.status)) {
    return riderName(openJob(jobs, 'delivery'));
  }
  return riderName(openJob(jobs, 'pickup'));
}

export const OrdersListPage = () => {
  const [prefsReady, setPrefsReady] = useState(false);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<GridFilters>(() => ({
    ...DEFAULT_FILTERS,
    columns: { ...EMPTY_TEXT_COLUMNS },
  }));
  const [applied, setApplied] = useState<GridFilters>(() => ({
    ...DEFAULT_FILTERS,
    columns: { ...EMPTY_TEXT_COLUMNS },
  }));
  const [autoApply, setAutoApply] = useState(false);
  const [visibleColumns, setVisibleColumns] =
    useState<OrderColumnKey[]>(DEFAULT_COLUMNS);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [applyMenuOpen, setApplyMenuOpen] = useState(false);
  const applyMenuRef = useRef<HTMLDivElement>(null);
  const pageSize = 25;

  const bulkUpdateMutation = trpc.orders.bulkUpdateStatus.useMutation();
  const advanceDeliveryMutation = trpc.orders.advanceDeliveryDay.useMutation();

  const debouncedDraftJson = useDebouncedValue(JSON.stringify(draft), 300);
  const appliedDateKey = dateRangeKey(
    applied.datePreset,
    applied.customFrom,
    applied.customTo,
  );
  const appliedDateRange = useMemo(
    () =>
      resolveOrderDateRange(
        applied.datePreset,
        applied.customFrom,
        applied.customTo,
      ),
    [applied.datePreset, applied.customFrom, applied.customTo],
  );

  const isDirty = !filtersEqual(draft, applied);
  const hasActiveFilters = hasNonDefaultFilters(applied) || isDirty;

  const statusPickOptions = useMemo(
    () =>
      STATUS_OPTIONS.map((s) => ({
        value: s,
        label: formatOrderStatus(s),
      })),
    [],
  );

  const communityPickOptions = useMemo(
    () => communities.map((c) => ({ value: c.id, label: c.name })),
    [communities],
  );

  const paymentPickOptions = useMemo(
    () => PAYMENT_OPTIONS.map((p) => ({ value: p.value, label: p.label })),
    [],
  );

  useEffect(() => {
    const prefs = loadPrefs();
    setDraft(prefs.draft);
    setApplied(prefs.applied);
    setAutoApply(prefs.autoApply);
    setVisibleColumns(prefs.visibleColumns);
    setPrefsReady(true);
  }, []);

  useEffect(() => {
    void fetchCommunityOptions().then(setCommunities);
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    savePrefs({
      visibleColumns,
      draft,
      applied,
      autoApply,
    });
  }, [prefsReady, visibleColumns, draft, applied, autoApply]);

  useEffect(() => {
    if (!autoApply || !prefsReady) return;
    try {
      const next = sanitizeFilters(JSON.parse(debouncedDraftJson));
      if (filtersEqual(applied, next)) return;
      setApplied(next);
      setPage(1);
      setSelectedIds(new Set());
    } catch {
      // ignore
    }
  }, [autoApply, prefsReady, debouncedDraftJson, applied]);

  useEffect(() => {
    if (!applyMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!applyMenuRef.current?.contains(e.target as Node)) {
        setApplyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [applyMenuOpen]);

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-orders',
      page,
      pageSize,
      applied.search,
      applied.status,
      applied.communityId,
      applied.paymentMethod,
      appliedDateKey,
      applied.columns,
      reloadKey,
    ],
    queryFn: () =>
      fetchOrders({
        page,
        pageSize,
        search: applied.search.trim() || undefined,
        status: applied.status.length > 0 ? applied.status : undefined,
        communityId:
          applied.communityId.length > 0 ? applied.communityId : undefined,
        paymentMethod:
          applied.paymentMethod.length > 0 ? applied.paymentMethod : undefined,
        dateFrom: appliedDateRange.from,
        dateTo: appliedDateRange.to,
        columnFilters: toColumnFilters(applied),
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    enabled: prefsReady,
  });

  const data = result?.data ?? [];
  const total = result?.total ?? 0;
  const refreshing = isFetching && !isLoading;

  const pageIds = useMemo(() => data.map((o) => o.id), [data]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  const updateDraft = (patch: Partial<GridFilters>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const updateDraftColumn = (
    key: keyof TextColumnFilters,
    value: string,
  ) => {
    setDraft((prev) => ({
      ...prev,
      columns: { ...prev.columns, [key]: value },
    }));
  };

  const setSearchDraft = (value: string) => {
    setDraft((prev) => ({ ...prev, search: value }));
  };

  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColumn = (key: OrderColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return ALL_COLUMN_KEYS.filter((k) => prev.includes(k) || k === key);
    });
  };

  const applyFilters = () => {
    setApplied(draft);
    setPage(1);
    setSelectedIds(new Set());
  };

  const clearFilters = () => {
    const next = {
      ...DEFAULT_FILTERS,
      columns: { ...EMPTY_TEXT_COLUMNS },
    };
    setDraft(next);
    setApplied(next);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleBulkUpdate = () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    const orderIds = Array.from(selectedIds);
    bulkUpdateMutation.mutate(
      { orderIds, status: bulkStatus, note: 'Bulk status update' },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setBulkStatus('');
          setReloadKey((k) => k + 1);
        },
      },
    );
  };

  const textFilterInput = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    ariaLabel: string,
  ) => (
    <input
      type="text"
      className={listStyles.colFilterInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );

  const dateFilterInput = (
    value: string,
    onChange: (v: string) => void,
    ariaLabel: string,
  ) => (
    <input
      type="date"
      className={listStyles.colFilterInput}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
    />
  );

  const dataColumns = useMemo(() => {
    const defs: Record<
      OrderColumnKey,
      {
        key: string;
        header: string;
        filter: ReactNode;
        render: (o: OrderRow) => ReactNode;
      }
    > = {
      order: {
        key: 'order',
        header: 'Order',
        filter: textFilterInput(
          draft.search,
          setSearchDraft,
          'Filter…',
          'Filter by order number',
        ),
        render: (o) => (
          <a href={`/admin/orders/${o.id}`} className={pageStyles.tab}>
            {o.order_number}
          </a>
        ),
      },
      customer: {
        key: 'customer',
        header: 'Customer',
        filter: textFilterInput(
          draft.columns.customer,
          (v) => updateDraftColumn('customer', v),
          'Filter…',
          'Filter by customer',
        ),
        render: (o) =>
          (o.profiles as { full_name: string } | null)?.full_name ?? '—',
      },
      phone: {
        key: 'phone',
        header: 'Phone',
        filter: textFilterInput(
          draft.columns.phone,
          (v) => updateDraftColumn('phone', v),
          'Filter…',
          'Filter by phone',
        ),
        render: (o) =>
          (o.profiles as { phone: string | null } | null)?.phone ?? '—',
      },
      community: {
        key: 'community',
        header: 'Community',
        filter: (
          <div className={listStyles.colFilterPick}>
            <Picklist
              multiple
              value={draft.communityId}
              options={communityPickOptions}
              onChange={(v) => updateDraft({ communityId: v })}
              emptyLabel="All"
              ariaLabel="Filter by community"
              placeholder="Search…"
            />
          </div>
        ),
        render: (o) =>
          (o.communities as { name: string } | null)?.name ?? '—',
      },
      address: {
        key: 'address',
        header: 'Address',
        filter: textFilterInput(
          draft.columns.address,
          (v) => updateDraftColumn('address', v),
          'Filter…',
          'Filter by address',
        ),
        render: (o) => {
          const addr = o.addresses as {
            flat_number: string;
            tower: string | null;
          } | null;
          if (!addr) return '—';
          return addr.tower
            ? `${addr.tower} · ${addr.flat_number}`
            : addr.flat_number;
        },
      },
      status: {
        key: 'status',
        header: 'Status',
        filter: (
          <div className={listStyles.colFilterPick}>
            <Picklist
              multiple
              value={draft.status}
              options={statusPickOptions}
              onChange={(v) => updateDraft({ status: v as OrderStatus[] })}
              emptyLabel="All"
              ariaLabel="Filter by status"
              placeholder="Search…"
            />
          </div>
        ),
        render: (o) => (
          <Badge variant={getOrderStatusBadge(o.status)}>
            {formatOrderStatus(o.status)}
          </Badge>
        ),
      },
      payment: {
        key: 'payment',
        header: 'Payment',
        filter: (
          <div className={listStyles.colFilterPick}>
            <Picklist
              multiple
              value={draft.paymentMethod}
              options={paymentPickOptions}
              onChange={(v) =>
                updateDraft({ paymentMethod: v as PaymentMethod[] })
              }
              emptyLabel="All"
              ariaLabel="Filter by payment method"
              placeholder="Search…"
            />
          </div>
        ),
        render: (o) =>
          o.payment_method === 'razorpay_direct'
            ? 'Razorpay'
            : o.payment_method === 'wallet'
              ? 'Wallet'
              : o.payment_method,
      },
      amount: {
        key: 'amount',
        header: 'Amount',
        filter: textFilterInput(
          draft.columns.amount,
          (v) => updateDraftColumn('amount', v),
          'Exact…',
          'Filter by amount',
        ),
        render: (o) => formatCurrency(Number(o.total_amount)),
      },
      pickup: {
        key: 'pickup',
        header: 'Pickup time',
        filter: dateFilterInput(
          draft.columns.pickup,
          (v) => updateDraftColumn('pickup', v),
          'Filter by pickup date',
        ),
        render: (o) =>
          formatSlotWindow(
            (o as { pickup_slot?: SlotEmbed | SlotEmbed[] | null }).pickup_slot,
          ),
      },
      delivery: {
        key: 'delivery',
        header: 'Delivery time',
        filter: dateFilterInput(
          draft.columns.delivery,
          (v) => updateDraftColumn('delivery', v),
          'Filter by delivery date',
        ),
        render: (o) =>
          formatSlotWindow(
            (o as { delivery_slot?: SlotEmbed | SlotEmbed[] | null })
              .delivery_slot,
          ),
      },
      rider: {
        key: 'rider',
        header: 'Current rider',
        filter: textFilterInput(
          draft.columns.rider,
          (v) => updateDraftColumn('rider', v),
          'Filter…',
          'Filter by current rider',
        ),
        render: (o) => currentRider(o),
      },
      pickupRider: {
        key: 'pickupRider',
        header: 'Pickup rider',
        filter: textFilterInput(
          draft.columns.pickupRider,
          (v) => updateDraftColumn('pickupRider', v),
          'Filter…',
          'Filter by pickup rider',
        ),
        render: (o) => riderName(openJob(getJobs(o), 'pickup')),
      },
      deliveryRider: {
        key: 'deliveryRider',
        header: 'Delivery rider',
        filter: textFilterInput(
          draft.columns.deliveryRider,
          (v) => updateDraftColumn('deliveryRider', v),
          'Filter…',
          'Filter by delivery rider',
        ),
        render: (o) => riderName(openJob(getJobs(o), 'delivery')),
      },
      rating: {
        key: 'rating',
        header: 'Rating',
        filter: textFilterInput(
          draft.columns.rating,
          (v) => updateDraftColumn('rating', v),
          '1–5',
          'Filter by rating',
        ),
        render: (o) => {
          const rating = (o as { customer_rating?: number | null })
            .customer_rating;
          if (rating == null) {
            return (o as { feedback_dismissed_at?: string | null })
              .feedback_dismissed_at
              ? 'Skipped'
              : '—';
          }
          return `${rating}/5`;
        },
      },
      feedback: {
        key: 'feedback',
        header: 'Feedback',
        filter: textFilterInput(
          draft.columns.feedback,
          (v) => updateDraftColumn('feedback', v),
          'Filter…',
          'Filter by feedback',
        ),
        render: (o) => {
          const text = (o as { customer_feedback?: string | null })
            .customer_feedback;
          if (!text?.trim()) return '—';
          return text.trim().length > 80
            ? `${text.trim().slice(0, 80)}…`
            : text.trim();
        },
      },
      instructions: {
        key: 'instructions',
        header: 'Special instructions',
        filter: textFilterInput(
          draft.columns.instructions,
          (v) => updateDraftColumn('instructions', v),
          'Filter…',
          'Filter by special instructions',
        ),
        render: (o) => {
          const text = (o as { special_instructions?: string | null })
            .special_instructions;
          if (!text?.trim()) return '—';
          return text.trim().length > 80
            ? `${text.trim().slice(0, 80)}…`
            : text.trim();
        },
      },
      booked: {
        key: 'booked',
        header: 'Booked',
        filter: dateFilterInput(
          draft.columns.booked,
          (v) => updateDraftColumn('booked', v),
          'Filter by booked date',
        ),
        render: (o) => formatRelativeTime(o.created_at),
      },
    };

    return visibleColumns.map((key) => defs[key]);
  }, [
    visibleColumns,
    draft,
    communityPickOptions,
    statusPickOptions,
    paymentPickOptions,
  ]);

  const tableColumns = useMemo(
    () => [
      {
        key: 'select',
        header: (
          <input
            type="checkbox"
            checked={allPageSelected}
            disabled={data.length === 0}
            ref={(el) => {
              if (el)
                el.indeterminate = somePageSelected && !allPageSelected;
            }}
            onChange={toggleAllPage}
            aria-label="Select all orders on this page"
          />
        ),
        filter: null as ReactNode,
        render: (o: OrderRow) => (
          <input
            type="checkbox"
            checked={selectedIds.has(o.id)}
            onChange={() => toggleOne(o.id)}
            aria-label={`Select order ${o.order_number}`}
          />
        ),
      },
      ...dataColumns,
    ],
    [
      allPageSelected,
      somePageSelected,
      data.length,
      dataColumns,
      selectedIds,
    ],
  );

  if (!prefsReady || (isLoading && !result)) return <Loader />;

  return (
    <div style={{ opacity: refreshing ? 0.85 : 1 }}>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search by order number..."
          value={draft.search}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <select
          className={pageStyles.select}
          value={draft.datePreset}
          onChange={(e) =>
            updateDraft({ datePreset: e.target.value as OrderDatePreset })
          }
          aria-label="Filter by pickup date"
        >
          {ORDER_DATE_PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {draft.datePreset === 'custom' ? (
          <>
            <input
              type="date"
              className={pageStyles.select}
              value={draft.customFrom}
              onChange={(e) => updateDraft({ customFrom: e.target.value })}
              aria-label="Custom from date"
            />
            <input
              type="date"
              className={pageStyles.select}
              value={draft.customTo}
              onChange={(e) => updateDraft({ customTo: e.target.value })}
              aria-label="Custom to date"
            />
          </>
        ) : null}
        <Picklist
          multiple
          value={draft.status}
          options={statusPickOptions}
          onChange={(v) => updateDraft({ status: v as OrderStatus[] })}
          emptyLabel="All statuses"
          ariaLabel="Filter by status"
          placeholder="Search status…"
        />
        <Picklist
          multiple
          value={draft.communityId}
          options={communityPickOptions}
          onChange={(v) => updateDraft({ communityId: v })}
          emptyLabel="All communities"
          ariaLabel="Filter by community"
          placeholder="Search community…"
        />
        <Picklist
          multiple
          value={draft.paymentMethod}
          options={paymentPickOptions}
          onChange={(v) =>
            updateDraft({ paymentMethod: v as PaymentMethod[] })
          }
          emptyLabel="All payments"
          ariaLabel="Filter by payment method"
          placeholder="Search payment…"
        />

        <div className={listStyles.columnsWrap}>
          <button
            type="button"
            className={listStyles.columnsBtn}
            onClick={() => setColumnsOpen((o) => !o)}
            aria-expanded={columnsOpen}
          >
            Columns
          </button>
          {columnsOpen ? (
            <div className={listStyles.columnsMenu} role="menu">
              {ALL_COLUMN_KEYS.map((key) => (
                <label key={key} className={listStyles.columnsItem}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(key)}
                    onChange={() => toggleColumn(key)}
                  />
                  {COLUMN_LABELS[key]}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className={listStyles.applyWrap} ref={applyMenuRef}>
          <div className={listStyles.applySplit}>
            <Button
              size="sm"
              onClick={applyFilters}
              disabled={autoApply || !isDirty}
              aria-label="Apply filters"
            >
              Apply filters
            </Button>
            <button
              type="button"
              className={listStyles.applyChevron}
              onClick={() => setApplyMenuOpen((o) => !o)}
              aria-expanded={applyMenuOpen}
              aria-label="Apply filters options"
            >
              ▾
            </button>
          </div>
          {applyMenuOpen ? (
            <div className={listStyles.applyMenu} role="menu">
              <label className={listStyles.columnsItem}>
                <input
                  type="checkbox"
                  checked={autoApply}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setAutoApply(next);
                    if (next) {
                      setApplied(draft);
                      setPage(1);
                      setSelectedIds(new Set());
                    }
                  }}
                />
                Apply automatically
              </label>
            </div>
          ) : null}
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
        <div className={pageStyles.filtersAction}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              advanceDeliveryMutation.mutate(undefined, {
                onSuccess: (res) => {
                  window.alert(
                    res.advanced > 0
                      ? `Advanced ${res.advanced} order(s) to out for delivery.`
                      : 'No orders were eligible to advance.',
                  );
                  setReloadKey((k) => k + 1);
                },
                onError: (err) => {
                  window.alert(
                    err.message || 'Failed to advance delivery day orders.',
                  );
                },
              })
            }
            disabled={advanceDeliveryMutation.isPending}
          >
            {advanceDeliveryMutation.isPending
              ? 'Running…'
              : 'Run delivery day advance'}
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className={listStyles.bulkBar} role="region" aria-label="Bulk edit orders">
          <span className={listStyles.bulkCount}>{selectedIds.size} selected</span>
          <select
            className={pageStyles.select}
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as OrderStatus | '')}
            aria-label="Bulk status"
          >
            <option value="">Set status…</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {formatOrderStatus(s)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleBulkUpdate}
            disabled={!bulkStatus || bulkUpdateMutation.isPending}
          >
            {bulkUpdateMutation.isPending ? 'Updating…' : 'Apply to selected'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkUpdateMutation.isPending}
          >
            Clear selection
          </Button>
        </div>
      )}

      <div
        className={refreshing ? pageStyles.listRefreshing : undefined}
        aria-busy={refreshing}
      >
        <Table
          scrollable
          columns={tableColumns}
          data={data}
          keyExtractor={(o) => o.id}
        />
        {data.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Try adjusting your filters."
          />
        ) : (
          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / pageSize))}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
};
