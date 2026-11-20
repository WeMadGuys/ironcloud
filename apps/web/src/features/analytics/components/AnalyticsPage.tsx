'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card, Loader, RevenueBarChart, TrendLineChart } from '@/components';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { formatCurrency, toISODate } from '@/utils/format';

import {
  fetchAnalyticsBundle,
  summarizeAnalyticsOverview,
  summarizeCommunityPerformance,
} from '../services/analytics.service';
import { AppDownloadsCard } from './AppDownloadsCard';
import { OtpSendFailuresCard } from './OtpSendFailuresCard';
import { ServiceBookingsCard } from './ServiceBookingsCard';

import pageStyles from '@/styles/pages.module.css';

export const AnalyticsPage = () => {
  const { selectedDate } = useDateFilter();
  const dateKey = toISODate(selectedDate);
  const [ignoreCancelled, setIgnoreCancelled] = useState(false);
  const [ignoreFailed, setIgnoreFailed] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-analytics', dateKey],
    queryFn: () => fetchAnalyticsBundle(selectedDate),
    staleTime: 45_000,
  });

  const exclusion = useMemo(
    () => ({ ignoreCancelled, ignoreFailed }),
    [ignoreCancelled, ignoreFailed],
  );

  const overview = useMemo(() => {
    if (!data) return null;
    return summarizeAnalyticsOverview(data.overview.orders, data.overview, selectedDate, exclusion);
  }, [data, selectedDate, exclusion]);

  const communityChart = useMemo(() => {
    if (!data) return [];
    return summarizeCommunityPerformance(data.communities, exclusion)
      .slice(0, 8)
      .map((c) => ({ name: c.name, revenue: c.revenue }));
  }, [data, exclusion]);

  if (isLoading && !data) return <Loader />;
  if (!overview || !data) return <Loader />;

  return (
    <div style={{ opacity: isFetching && !isLoading ? 0.85 : 1 }}>
      <div className={pageStyles.filters}>
        <label className={pageStyles.checkLabel}>
          <input
            type="checkbox"
            checked={ignoreCancelled}
            onChange={(e) => setIgnoreCancelled(e.target.checked)}
          />
          Ignore cancelled orders
        </label>
        <label className={pageStyles.checkLabel}>
          <input
            type="checkbox"
            checked={ignoreFailed}
            onChange={(e) => setIgnoreFailed(e.target.checked)}
          />
          Ignore failed orders
        </label>
      </div>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{overview.dau}</div>
          <div className={pageStyles.statLabel}>DAU</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{overview.wau}</div>
          <div className={pageStyles.statLabel}>WAU</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{overview.mau}</div>
          <div className={pageStyles.statLabel}>MAU</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{formatCurrency(overview.revenue)}</div>
          <div className={pageStyles.statLabel}>30d Revenue</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{overview.totalOrders}</div>
          <div className={pageStyles.statLabel}>30d Orders</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{overview.cancellationRate.toFixed(1)}%</div>
          <div className={pageStyles.statLabel}>Cancellation</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{overview.refundRate.toFixed(1)}%</div>
          <div className={pageStyles.statLabel}>Refund Rate</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{formatCurrency(overview.aov)}</div>
          <div className={pageStyles.statLabel}>AOV</div>
        </div>
      </div>
      <div className={pageStyles.chartsRow}>
        <Card title="Revenue Trend">
          <TrendLineChart data={overview.revenueTrend} />
        </Card>
        <Card title="Revenue by Community">
          <RevenueBarChart data={communityChart} />
        </Card>
      </div>
      <ServiceBookingsCard exclusion={exclusion} />
      <AppDownloadsCard stats={data.appDownloads} />
      <OtpSendFailuresCard stats={data.otpSendFailures} />
      <Card title="Growth">
        <p>Total Customers: {overview.totalCustomers}</p>
        <p>Total Partners: {overview.totalPartners}</p>
        <p>Total Riders: {overview.totalRiders}</p>
      </Card>
    </div>
  );
};
