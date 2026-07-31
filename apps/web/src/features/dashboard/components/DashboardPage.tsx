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
import { useEffect, useMemo, useState } from 'react';

import {
  Card,
  Loader,
  OrdersAreaChart,
  SearchInput,
  StatCard,
  StatCardIcon,
  StatusDonutChart,
} from '@/components';
import { Badge } from '@/components/Badge/Badge';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getSupabase } from '@/lib/supabase';
import {
  formatCurrency,
  formatOrderStatus,
  formatRelativeTime,
  getOrderStatusBadge,
  parseISODate,
  toISODate,
} from '@/utils/format';
import type { OrderStatus } from '@ironcloud/db';

import { fetchDashboardBundle, type DashboardKpiKey } from '../services/dashboard.service';
import { DashboardKpiDetailModal } from './DashboardKpiDetailModal';

import pageStyles from '@/styles/pages.module.css';
import styles from './DashboardPage.module.css';

const calcTrend = (current: number, previous: number) => {
  if (previous === 0) return { value: '—', direction: 'neutral' as const };
  const pct = ((current - previous) / previous) * 100;
  return {
    value: `${Math.abs(pct).toFixed(1)}% vs previous day`,
    direction: pct >= 0 ? ('positive' as const) : ('negative' as const),
  };
};

export const DashboardPage = () => {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [chartDays, setChartDays] = useState(7);
  const [communityId, setCommunityId] = useState('');
  const [search, setSearch] = useState('');
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [activeKpi, setActiveKpi] = useState<DashboardKpiKey | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const dateKey = toISODate(selectedDate);

  useEffect(() => {
    void fetchCommunityOptions().then(setCommunities);
  }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-dashboard', dateKey, chartDays, communityId || 'all'],
    queryFn: () =>
      fetchDashboardBundle(selectedDate, chartDays, communityId || undefined),
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

  const filteredRecentOrders = useMemo(() => {
    const orders = data?.recentOrders ?? [];
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const profile = o.profiles as { full_name: string } | null;
      return (
        o.order_number.toLowerCase().includes(q) ||
        (profile?.full_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [data?.recentOrders, debouncedSearch]);

  if (isLoading && !data) return <Loader />;

  const kpis = data!.kpis;
  const overview = data!.overview;
  const statusDist = data!.statusDist;
  const topCommunities = data!.topCommunities;
  const topPartners = data!.topPartners;
  const lowWallet = data!.lowWallet;

  const orderTrend = calcTrend(
    kpis.trends.totalOrders.value,
    kpis.trends.totalOrders.previous,
  );

  return (
    <div style={{ opacity: isFetching && !isLoading ? 0.85 : 1 }}>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search recent orders..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <input
          type="date"
          className={pageStyles.select}
          value={dateKey}
          onChange={(e) => {
            if (!e.target.value) return;
            setSelectedDate(parseISODate(e.target.value));
          }}
          aria-label="Dashboard date"
        />
        <select
          className={pageStyles.select}
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
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
          value={String(chartDays)}
          onChange={(e) => setChartDays(Number(e.target.value))}
          aria-label="Chart range"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </div>

      <div className={styles.kpiGrid}>
        <StatCard
          label="Total Orders"
          value={kpis.totalOrders}
          icon={<StatCardIcon path={mdiPackageVariant} />}
          iconVariant="accent"
          trend={orderTrend}
          actionLabel="View details →"
          onClick={() => setActiveKpi('totalOrders')}
        />
        <StatCard
          label="Pending Pickups"
          value={kpis.pendingPickups}
          icon={<StatCardIcon path={mdiClipboardCheck} color="var(--ic-status-info)" />}
          iconVariant="info"
          actionLabel="View details →"
          onClick={() => setActiveKpi('pendingPickups')}
        />
        <StatCard
          label="In Progress"
          value={kpis.inProgress}
          icon={<StatCardIcon path={mdiPackageVariant} color="var(--ic-status-warning)" />}
          iconVariant="warning"
          actionLabel="View details →"
          onClick={() => setActiveKpi('inProgress')}
        />
        <StatCard
          label="Out for Delivery"
          value={kpis.outForDelivery}
          icon={<StatCardIcon path={mdiTruckDelivery} color="var(--ic-status-purple)" />}
          iconVariant="purple"
          actionLabel="View details →"
          onClick={() => setActiveKpi('outForDelivery')}
        />
        <StatCard
          label="Delivered"
          value={kpis.delivered}
          icon={<StatCardIcon path={mdiClipboardCheck} color="var(--ic-status-success)" />}
          iconVariant="success"
          actionLabel="View details →"
          onClick={() => setActiveKpi('delivered')}
        />
        <StatCard
          label="Revenue"
          value={formatCurrency(kpis.revenueToday)}
          icon={<StatCardIcon path={mdiCash} />}
          iconVariant="success"
          actionLabel="View details →"
          onClick={() => setActiveKpi('revenue')}
        />
        <StatCard
          label="Wallet Balance"
          value={formatCurrency(kpis.walletBalance)}
          icon={<StatCardIcon path={mdiWallet} />}
          iconVariant="info"
          actionLabel="View details →"
          onClick={() => setActiveKpi('walletBalance')}
        />
        <StatCard
          label="Active Customers"
          value={kpis.activeCustomers}
          icon={<StatCardIcon path={mdiAccountGroup} />}
          iconVariant="accent"
          actionLabel="View details →"
          onClick={() => setActiveKpi('activeCustomers')}
        />
        <StatCard
          label="Active Partners"
          value={kpis.activePartners}
          icon={<StatCardIcon path={mdiHandshake} />}
          iconVariant="purple"
          actionLabel="View details →"
          onClick={() => setActiveKpi('activePartners')}
        />
        <StatCard
          label="Active Riders"
          value={kpis.activeRiders}
          icon={<StatCardIcon path={mdiBike} />}
          iconVariant="warning"
          actionLabel="View details →"
          onClick={() => setActiveKpi('activeRiders')}
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
            {filteredRecentOrders.length === 0 ? (
              <li className={styles.listMeta}>No matching orders</li>
            ) : (
              filteredRecentOrders.map((o) => {
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
              })
            )}
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

      <DashboardKpiDetailModal
        kpi={activeKpi}
        date={selectedDate}
        communityId={communityId || undefined}
        onClose={() => setActiveKpi(null)}
      />
    </div>
  );
};
