'use client';

import { useEffect, useRef, useState } from 'react';

import { Badge, EmptyState, Loader, Pagination, SearchInput, Table } from '@/components';
import type { OrderStatus } from '@ironcloud/db';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCurrency, formatOrderStatus, formatRelativeTime, getOrderStatusBadge } from '@/utils/format';

import { fetchOrders } from '../services/orders.service';

import pageStyles from '@/styles/pages.module.css';

const STATUS_OPTIONS: OrderStatus[] = [
  'booked', 'pickup_assigned', 'picked_up', 'ironing', 'out_for_delivery', 'delivered', 'cancelled',
];

export const OrdersListPage = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchOrders>>['data']>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const pageSize = 25;

  useEffect(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    fetchOrders({
      page,
      pageSize,
      search: debouncedSearch || undefined,
      status: status || undefined,
    }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    });
  }, [page, debouncedSearch, status]);

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
      </div>

      <div className={refreshing ? pageStyles.listRefreshing : undefined} aria-busy={refreshing}>
        {data.length === 0 ? (
          <EmptyState title="No orders found" description="Try adjusting your filters." />
        ) : (
          <>
            <Table
              columns={[
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
                  key: 'amount',
                  header: 'Amount',
                  render: (o) => formatCurrency(Number(o.total_amount)),
                },
                {
                  key: 'time',
                  header: 'Time',
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
