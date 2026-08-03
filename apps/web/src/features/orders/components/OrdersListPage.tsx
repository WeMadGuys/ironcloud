'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

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

import { fetchOrders } from '../services/orders.service';
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

const STORAGE_KEY = 'ironcloud_orders_columns';

function loadVisibleColumns(): OrderColumnKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return DEFAULT_COLUMNS;
    const allowed = new Set(Object.keys(COLUMN_LABELS) as OrderColumnKey[]);
    const next = parsed.filter((k): k is OrderColumnKey =>
      allowed.has(k as OrderColumnKey),
    );
    return next.length > 0 ? next : DEFAULT_COLUMNS;
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function saveVisibleColumns(keys: OrderColumnKey[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
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
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<OrderStatus[]>([]);
  const [communityId, setCommunityId] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod[]>([]);
  const [datePreset, setDatePreset] = useState<OrderDatePreset>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] =
    useState<OrderColumnKey[]>(loadVisibleColumns);
  const pageSize = 25;

  const bulkUpdateMutation = trpc.orders.bulkUpdateStatus.useMutation();
  const advanceDeliveryMutation = trpc.orders.advanceDeliveryDay.useMutation();

  const dateKey = dateRangeKey(datePreset, customFrom, customTo);
  const dateRange = useMemo(
    () => resolveOrderDateRange(datePreset, customFrom, customTo),
    [datePreset, customFrom, customTo],
  );

  const hasActiveFilters = Boolean(
    search ||
      status.length > 0 ||
      communityId.length > 0 ||
      paymentMethod.length > 0 ||
      datePreset !== 'today',
  );

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
    void fetchCommunityOptions().then(setCommunities);
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [dateKey, debouncedSearch, status, communityId, paymentMethod]);

  useEffect(() => {
    saveVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-orders',
      page,
      pageSize,
      debouncedSearch,
      status,
      communityId,
      paymentMethod,
      dateKey,
      reloadKey,
    ],
    queryFn: () =>
      fetchOrders({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        status: status.length > 0 ? status : undefined,
        communityId: communityId.length > 0 ? communityId : undefined,
        paymentMethod: paymentMethod.length > 0 ? paymentMethod : undefined,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const data = result?.data ?? [];
  const total = result?.total ?? 0;
  const refreshing = isFetching && !isLoading;

  const pageIds = useMemo(() => data.map((o) => o.id), [data]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

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
      return [...prev, key];
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatus([]);
    setCommunityId([]);
    setPaymentMethod([]);
    setDatePreset('today');
    setCustomFrom('');
    setCustomTo('');
    setPage(1);
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

  const dataColumns = useMemo(() => {
    const defs: Record<
      OrderColumnKey,
      {
        key: string;
        header: string;
        render: (o: OrderRow) => ReactNode;
      }
    > = {
      order: {
        key: 'order',
        header: 'Order',
        render: (o) => (
          <a href={`/admin/orders/${o.id}`} className={pageStyles.tab}>
            {o.order_number}
          </a>
        ),
      },
      customer: {
        key: 'customer',
        header: 'Customer',
        render: (o) =>
          (o.profiles as { full_name: string } | null)?.full_name ?? '—',
      },
      phone: {
        key: 'phone',
        header: 'Phone',
        render: (o) =>
          (o.profiles as { phone: string | null } | null)?.phone ?? '—',
      },
      community: {
        key: 'community',
        header: 'Community',
        render: (o) =>
          (o.communities as { name: string } | null)?.name ?? '—',
      },
      address: {
        key: 'address',
        header: 'Address',
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
        render: (o) => (
          <Badge variant={getOrderStatusBadge(o.status)}>
            {formatOrderStatus(o.status)}
          </Badge>
        ),
      },
      payment: {
        key: 'payment',
        header: 'Payment',
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
        render: (o) => formatCurrency(Number(o.total_amount)),
      },
      pickup: {
        key: 'pickup',
        header: 'Pickup time',
        render: (o) =>
          formatSlotWindow(
            (o as { pickup_slot?: SlotEmbed | SlotEmbed[] | null }).pickup_slot,
          ),
      },
      delivery: {
        key: 'delivery',
        header: 'Delivery time',
        render: (o) =>
          formatSlotWindow(
            (o as { delivery_slot?: SlotEmbed | SlotEmbed[] | null })
              .delivery_slot,
          ),
      },
      rider: {
        key: 'rider',
        header: 'Current rider',
        render: (o) => currentRider(o),
      },
      pickupRider: {
        key: 'pickupRider',
        header: 'Pickup rider',
        render: (o) => riderName(openJob(getJobs(o), 'pickup')),
      },
      deliveryRider: {
        key: 'deliveryRider',
        header: 'Delivery rider',
        render: (o) => riderName(openJob(getJobs(o), 'delivery')),
      },
      rating: {
        key: 'rating',
        header: 'Rating',
        render: (o) => {
          const rating = (o as { customer_rating?: number | null }).customer_rating;
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
        render: (o) => {
          const text = (o as { customer_feedback?: string | null })
            .customer_feedback;
          if (!text?.trim()) return '—';
          return text.trim().length > 80
            ? `${text.trim().slice(0, 80)}…`
            : text.trim();
        },
      },
      booked: {
        key: 'booked',
        header: 'Booked',
        render: (o) => formatRelativeTime(o.created_at),
      },
    };

    return visibleColumns.map((key) => defs[key]);
  }, [visibleColumns]);

  if (isLoading && !result) return <Loader />;

  return (
    <div style={{ opacity: refreshing ? 0.85 : 1 }}>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search by order number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={pageStyles.select}
          value={datePreset}
          onChange={(e) => {
            setDatePreset(e.target.value as OrderDatePreset);
            setPage(1);
          }}
          aria-label="Filter by pickup date"
        >
          {ORDER_DATE_PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {datePreset === 'custom' ? (
          <>
            <input
              type="date"
              className={pageStyles.select}
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setPage(1);
              }}
              aria-label="Custom from date"
            />
            <input
              type="date"
              className={pageStyles.select}
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPage(1);
              }}
              aria-label="Custom to date"
            />
          </>
        ) : null}
        <Picklist
          multiple
          value={status}
          options={statusPickOptions}
          onChange={(v) => {
            setStatus(v as OrderStatus[]);
            setPage(1);
          }}
          emptyLabel="All statuses"
          ariaLabel="Filter by status"
          placeholder="Search status…"
        />
        <Picklist
          multiple
          value={communityId}
          options={communityPickOptions}
          onChange={(v) => {
            setCommunityId(v);
            setPage(1);
          }}
          emptyLabel="All communities"
          ariaLabel="Filter by community"
          placeholder="Search community…"
        />
        <Picklist
          multiple
          value={paymentMethod}
          options={paymentPickOptions}
          onChange={(v) => {
            setPaymentMethod(v as PaymentMethod[]);
            setPage(1);
          }}
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
              {(Object.keys(COLUMN_LABELS) as OrderColumnKey[]).map((key) => (
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

        {hasActiveFilters && (
          <div className={pageStyles.filtersAction}>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
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
        {data.length === 0 ? (
          <EmptyState
            title="No orders found"
            description="Try adjusting your filters."
          />
        ) : (
          <>
            <Table
              columns={[
                {
                  key: 'select',
                  header: (
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            somePageSelected && !allPageSelected;
                      }}
                      onChange={toggleAllPage}
                      aria-label="Select all orders on this page"
                    />
                  ),
                  render: (o) => (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={() => toggleOne(o.id)}
                      aria-label={`Select order ${o.order_number}`}
                    />
                  ),
                },
                ...dataColumns,
              ]}
              data={data}
              keyExtractor={(o) => o.id}
            />
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / pageSize))}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
};
