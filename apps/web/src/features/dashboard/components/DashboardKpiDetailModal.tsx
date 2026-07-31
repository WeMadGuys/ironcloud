'use client';

import { useQuery } from '@tanstack/react-query';

import { Badge, EmptyState, Loader, Modal, Table } from '@/components';
import {
  formatCurrency,
  formatOrderStatus,
  formatRelativeTime,
  getOrderStatusBadge,
  toISODate,
} from '@/utils/format';
import type { OrderStatus } from '@ironcloud/db';

import {
  DASHBOARD_KPI_TITLES,
  fetchDashboardKpiDetails,
  type DashboardKpiKey,
} from '../services/dashboard.service';

type Props = {
  kpi: DashboardKpiKey | null;
  date: Date;
  communityId?: string;
  onClose: () => void;
};

export const DashboardKpiDetailModal = ({ kpi, date, communityId, onClose }: Props) => {
  const dateKey = toISODate(date);
  const open = kpi !== null;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard-kpi', kpi, dateKey, communityId || 'all'],
    queryFn: () => fetchDashboardKpiDetails(kpi!, date, communityId),
    enabled: open,
    staleTime: 30_000,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kpi ? DASHBOARD_KPI_TITLES[kpi] : ''}
      size="xwide"
    >
      {isLoading || !data ? (
        <Loader />
      ) : data.kind === 'orders' ? (
        data.rows.length === 0 ? (
          <EmptyState title="No orders" description="Nothing matches this KPI for the selected filters." />
        ) : (
          <Table
            columns={[
              {
                key: 'order',
                header: 'Order',
                render: (o) => (
                  <a href={`/admin/orders/${o.id}`}>{o.order_number}</a>
                ),
              },
              {
                key: 'customer',
                header: 'Customer',
                render: (o) => o.profiles?.full_name ?? '—',
              },
              {
                key: 'community',
                header: 'Community',
                render: (o) => o.communities?.name ?? '—',
              },
              {
                key: 'status',
                header: 'Status',
                render: (o) => (
                  <Badge variant={getOrderStatusBadge(o.status as OrderStatus)}>
                    {formatOrderStatus(o.status)}
                  </Badge>
                ),
              },
              {
                key: 'amount',
                header: 'Amount',
                render: (o) => formatCurrency(Number(o.total_amount)),
              },
              {
                key: 'booked',
                header: 'Booked',
                render: (o) => formatRelativeTime(o.created_at),
              },
            ]}
            data={data.rows}
            keyExtractor={(o) => o.id}
          />
        )
      ) : data.kind === 'wallets' ? (
        data.rows.length === 0 ? (
          <EmptyState title="No wallets" description="No wallet balances found." />
        ) : (
          <Table
            columns={[
              {
                key: 'customer',
                header: 'Customer',
                render: (w) => w.profiles?.full_name ?? '—',
              },
              {
                key: 'phone',
                header: 'Phone',
                render: (w) => w.profiles?.phone ?? '—',
              },
              {
                key: 'balance',
                header: 'Balance',
                render: (w) => formatCurrency(Number(w.balance)),
              },
            ]}
            data={data.rows}
            keyExtractor={(w) => w.id}
          />
        )
      ) : data.kind === 'customers' ? (
        data.rows.length === 0 ? (
          <EmptyState title="No customers" description="No customers ordered on this date." />
        ) : (
          <Table
            columns={[
              {
                key: 'name',
                header: 'Customer',
                render: (c) => (
                  <a href={`/admin/customers/${c.id}`}>{c.full_name}</a>
                ),
              },
              {
                key: 'phone',
                header: 'Phone',
                render: (c) => c.phone ?? '—',
              },
              {
                key: 'orders',
                header: 'Orders today',
                render: (c) => c.order_count,
              },
            ]}
            data={data.rows}
            keyExtractor={(c) => c.id}
          />
        )
      ) : data.kind === 'partners' ? (
        data.rows.length === 0 ? (
          <EmptyState title="No partners" description="No active partners found." />
        ) : (
          <Table
            columns={[
              {
                key: 'name',
                header: 'Partner',
                render: (p) => <a href={`/admin/partners/${p.id}`}>{p.name}</a>,
              },
              {
                key: 'rating',
                header: 'Rating',
                render: (p) => `★ ${(p.rating_avg ?? 0).toFixed(1)}`,
              },
              {
                key: 'active',
                header: 'Status',
                render: (p) => (p.is_active ? 'Active' : 'Inactive'),
              },
            ]}
            data={data.rows}
            keyExtractor={(p) => p.id}
          />
        )
      ) : data.rows.length === 0 ? (
        <EmptyState title="No riders" description="No riders found." />
      ) : (
        <Table
          columns={[
            {
              key: 'name',
              header: 'Rider',
              render: (r) => (
                <a href={`/admin/riders/${r.id}`}>{r.profiles?.full_name ?? '—'}</a>
              ),
            },
            {
              key: 'phone',
              header: 'Phone',
              render: (r) => r.profiles?.phone ?? '—',
            },
            {
              key: 'vehicle',
              header: 'Vehicle',
              render: (r) => r.vehicle_number ?? '—',
            },
            {
              key: 'kyc',
              header: 'KYC',
              render: (r) => r.kyc_status,
            },
            {
              key: 'rating',
              header: 'Rating',
              render: (r) => `★ ${Number(r.rating_avg).toFixed(1)}`,
            },
            {
              key: 'active',
              header: 'Status',
              render: (r) => (r.is_active ? 'Active' : 'Inactive'),
            },
          ]}
          data={data.rows}
          keyExtractor={(r) => r.id}
        />
      )}
    </Modal>
  );
};
