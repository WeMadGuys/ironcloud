'use client';

import {
  mdiAccountGroup,
  mdiBike,
  mdiCash,
  mdiClipboardCheck,
  mdiHandshake,
  mdiPackageVariant,
  mdiTruckDelivery,
  mdiWallet,
} from '@mdi/js';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Card, Loader, OrdersAreaChart, StatCard, StatCardIcon, StatusDonutChart } from '@/components';
import { Badge } from '@/components/Badge/Badge';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { getSupabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatOrderStatus,
  formatRelativeTime,
  getOrderStatusBadge,
  toISODate,
} from '@/utils/format';
import type { OrderStatus } from '@ironcloud/db';

import { fetchDashboardBundle } from '../services/dashboard.service';

import styles from './DashboardPage.module.css';

const calcTrend = (current: number, previous: number) => {
  if (previous === 0) return { value: '—', direction: 'neutral' as const };
  const pct = ((current - previous) / previous) * 100;
  return {
    value: `${Math.abs(pct).toFixed(1)}% vs yesterday`,
    direction: pct >= 0 ? ('positive' as const) : ('negative' as const),
  };
};

export const DashboardPage = () => {
  const { selectedDate } = useDateFilter();
  const dateKey = toISODate(selectedDate);
  const [chartDays, setChartDays] = useState(7);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-dashboard', dateKey, chartDays],
    queryFn: () => fetchDashboardBundle(selectedDate, chartDays),
    staleTime: 45_000,
  });

  // Soft realtime: debounce full reloads so live order churn doesn't thrash the page.
  useEffect(() => {
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void refetch();
        }, 2500);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refetch]);

  if (isLoading && !data) return <Loader />;

  const kpis = data!.kpis;
  const overview = data!.overview;
  const statusDist = data!.statusDist;
  const topCommunities = data!.topCommunities;
  const topPartners = data!.topPartners;
  const recentOrders = data!.recentOrders;
  const lowWallet = data!.lowWallet;

  const orderTrend = calcTrend(
    kpis.trends.totalOrders.value,
    kpis.trends.totalOrders.previous,
  );

  return (
    <div style={{ opacity: isFetching && !isLoading ? 0.85 : 1 }}>
      <div className={styles.kpiGrid}>
        <StatCard
          label="Total Orders"
          value={kpis.totalOrders}
          icon={<StatCardIcon path={mdiPackageVariant} />}
          iconVariant="accent"
          trend={orderTrend}
          actionLabel="View details →"
          actionHref="/admin/orders"
        />
        <StatCard
          label="Pending Pickups"
          value={kpis.pendingPickups}
          icon={<StatCardIcon path={mdiClipboardCheck} color="var(--ic-status-info)" />}
          iconVariant="info"
        />
        <StatCard
          label="In Progress"
          value={kpis.inProgress}
          icon={<StatCardIcon path={mdiPackageVariant} color="var(--ic-status-warning)" />}
          iconVariant="warning"
        />
        <StatCard
          label="Out for Delivery"
          value={kpis.outForDelivery}
          icon={<StatCardIcon path={mdiTruckDelivery} color="var(--ic-status-purple)" />}
          iconVariant="purple"
        />
        <StatCard
          label="Delivered"
          value={kpis.delivered}
          icon={<StatCardIcon path={mdiClipboardCheck} color="var(--ic-status-success)" />}
          iconVariant="success"
        />
        <StatCard
          label="Revenue Today"
          value={formatCurrency(kpis.revenueToday)}
          icon={<StatCardIcon path={mdiCash} />}
          iconVariant="success"
        />
        <StatCard
          label="Wallet Balance"
          value={formatCurrency(kpis.walletBalance)}
          icon={<StatCardIcon path={mdiWallet} />}
          iconVariant="info"
        />
        <StatCard
          label="Active Customers"
          value={kpis.activeCustomers}
          icon={<StatCardIcon path={mdiAccountGroup} />}
          iconVariant="accent"
        />
        <StatCard
          label="Active Partners"
          value={kpis.activePartners}
          icon={<StatCardIcon path={mdiHandshake} />}
          iconVariant="purple"
        />
        <StatCard
          label="Active Riders"
          value={kpis.activeRiders}
          icon={<StatCardIcon path={mdiBike} />}
          iconVariant="warning"
        />
      </div>

      <div className={styles.chartsRow}>
        <Card
          title="Orders Overview"
          action={{
            label: `${chartDays} Days`,
            onClick: () => setChartDays(chartDays === 7 ? 30 : 7),
          }}
        >
          <OrdersAreaChart data={overview} />
        </Card>
        <Card title="Order Status Distribution">
          <StatusDonutChart data={statusDist} />
        </Card>
      </div>

      <div className={styles.widgetsRow}>
        <Card title="Top Communities" action={{ label: 'View all', href: '/admin/communities' }}>
          <ul className={styles.list}>
            {topCommunities.map((c, i) => (
              <li key={c.id} className={styles.listItem}>
                <div className="flex items-center gap-md">
                  <span className={styles.rank}>{i + 1}</span>
                  <span>{c.name}</span>
                </div>
                <span className={styles.listMeta}>{c.count} orders</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recent Orders" action={{ label: 'View all', href: '/admin/orders' }}>
          <ul className={styles.list}>
            {recentOrders.map((o) => {
              const profile = o.profiles as { full_name: string } | null;
              const address = o.addresses as { flat_number: string; tower: string } | null;
              return (
                <li key={o.id} className={styles.listItem}>
                  <div>
                    <a href={`/admin/orders/${o.id}`}>{o.order_number}</a>
                    <div className={styles.listMeta}>
                      {profile?.full_name} · {address?.tower}-{address?.flat_number}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-xs">
                    <Badge variant={getOrderStatusBadge(o.status as OrderStatus)}>
                      {formatOrderStatus(o.status)}
                    </Badge>
                    <span className={styles.listMeta}>
                      {formatRelativeTime(o.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Partner Performance" action={{ label: 'View all', href: '/admin/partners' }}>
          <ul className={styles.list}>
            {topPartners.map((p) => (
              <li key={p.id} className={styles.listItem}>
                <span>{p.name}</span>
                <div className="flex items-center gap-md">
                  <span className={styles.listMeta}>{p.count} orders</span>
                  <span>★ {p.rating.toFixed(1)}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {lowWallet.length > 0 && (
        <Card title="Low Wallet Users" action={{ label: 'View wallet', href: '/admin/wallet' }}>
          <ul className={styles.list}>
            {lowWallet.map((w) => {
              const profile = w.profiles as { full_name: string; phone: string } | null;
              return (
                <li key={w.balance + (profile?.phone ?? '')} className={styles.listItem}>
                  <span>{profile?.full_name ?? 'Unknown'}</span>
                  <span className={styles.listMeta}>{formatCurrency(Number(w.balance))}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
};
