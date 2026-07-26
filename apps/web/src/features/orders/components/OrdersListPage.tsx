'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge, Button, EmptyState, Loader, Pagination, SearchInput, Table } from '@/components';
import type { OrderStatus, PaymentMethod } from '@ironcloud/db';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { fetchCommunityOptions, type CommunityOption } from '@/features/communities/services/communities.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { trpc } from '@/lib/trpc';
import {
  formatCurrency,
  formatOrderStatus,
  formatRelativeTime,
  getOrderStatusBadge,
  toISODate,
} from '@/utils/format';

import { fetchOrders } from '../services/orders.service';

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

const formatPickupSlot = (order: {
  pickup_slot?: { window_start: string } | { window_start: string }[] | null;
}): string => {
  const slot = order.pickup_slot;
  const windowStart = Array.isArray(slot) ? slot[0]?.window_start : slot?.window_start;
  if (!windowStart) return '—';
  return new Date(windowStart).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

type OrderRow = Awaited<ReturnType<typeof fetchOrders>>['data'][number];

export const OrdersListPage = () => {
  const { selectedDate } = useDateFilter();
  const selectedDateKey = toISODate(selectedDate);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [communityId, setCommunityId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [data, setData] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | ''>('');
  const [reloadKey, setReloadKey] = useState(0);
  const hasLoadedRef = useRef(false);
  const pageSize = 25;

  const bulkUpdateMutation = trpc.orders.bulkUpdateStatus.useMutation();

  const hasActiveFilters = Boolean(search || status || communityId || paymentMethod);

  useEffect(() => {
    fetchCommunityOptions().then(setCommunities);
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [selectedDateKey, debouncedSearch, status, communityId, paymentMethod]);

  useEffect(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    fetchOrders({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      status: status || undefined,
      communityId: communityId || undefined,
      paymentMethod: paymentMethod || undefined,
      date: selectedDate,
    }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    });
  }, [page, debouncedSearch, status, communityId, paymentMethod, selectedDateKey, selectedDate, reloadKey]);

  const pageIds = useMemo(() => data.map((o) => o.id), [data]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
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

  const clearFilters = () => {
    setSearch('');
    setStatus('');
    setCommunityId('');
    setPaymentMethod('');
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

  if (loading) return <Loader fullPage />;

  return (
    <div>
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
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as OrderStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {formatOrderStatus(s)}
            </option>
          ))}
        </select>
        <select
          className={pageStyles.select}
          value={communityId}
          onChange={(e) => {
            setCommunityId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by community"
        >
          <option value="">All communities</option>
          {communities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={pageStyles.select}
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value as PaymentMethod | '');
            setPage(1);
          }}
          aria-label="Filter by payment method"
        >
          <option value="">All payments</option>
          {PAYMENT_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <div className={pageStyles.filtersAction}>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}
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

      <div className={refreshing ? pageStyles.listRefreshing : undefined} aria-busy={refreshing}>
        {data.length === 0 ? (
          <EmptyState title="No orders found" description="Try adjusting your filters." />
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
                        if (el) el.indeterminate = somePageSelected && !allPageSelected;
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
                {
                  key: 'order',
                  header: 'Order',
                  render: (o) => (
                    <a href={`/admin/orders/${o.id}`} className={pageStyles.tab}>
                      {o.order_number}
                    </a>
                  ),
                },
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (o) => (o.profiles as { full_name: string } | null)?.full_name ?? '—',
                },
                {
                  key: 'community',
                  header: 'Community',
                  render: (o) => (o.communities as { name: string } | null)?.name ?? '—',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (o) => (
                    <Badge variant={getOrderStatusBadge(o.status)}>{formatOrderStatus(o.status)}</Badge>
                  ),
                },
                {
                  key: 'payment',
                  header: 'Payment',
                  render: (o) =>
                    o.payment_method === 'razorpay_direct' ? 'Razorpay' : o.payment_method === 'wallet' ? 'Wallet' : o.payment_method,
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (o) => formatCurrency(Number(o.total_amount)),
                },
                {
                  key: 'pickup',
                  header: 'Pickup',
                  render: (o) => formatPickupSlot(o),
                },
                {
                  key: 'booked',
                  header: 'Booked',
                  render: (o) => formatRelativeTime(o.created_at),
                },
              ]}
              data={data}
              keyExtractor={(o) => o.id}
            />
            <Pagination
              page={page}
              totalPages={Math.ceil(total / pageSize)}
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
