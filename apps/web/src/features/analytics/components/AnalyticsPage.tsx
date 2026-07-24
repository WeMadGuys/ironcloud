'use client';

import { useEffect, useState } from 'react';

import { Card, Loader, RevenueBarChart, TrendLineChart } from '@/components';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { formatCurrency } from '@/utils/format';

import { fetchAnalyticsOverview, fetchCommunityPerformance } from '../services/analytics.service';

import pageStyles from '@/styles/pages.module.css';

export const AnalyticsPage = () => {
  const { selectedDate } = useDateFilter();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchAnalyticsOverview>> | null>(null);
  const [communities, setCommunities] = useState<Awaited<ReturnType<typeof fetchCommunityPerformance>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAnalyticsOverview(selectedDate), fetchCommunityPerformance()]).then(([o, c]) => {
      setOverview(o);
      setCommunities(c);
      setLoading(false);
    });
  }, [selectedDate]);

  if (loading || !overview) return <Loader fullPage />;

  const communityChart = communities.slice(0, 8).map((c) => ({ name: c.name, revenue: c.revenue }));

  return (
    <div>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{overview.dau}</div><div className={pageStyles.statLabel}>DAU</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{overview.wau}</div><div className={pageStyles.statLabel}>WAU</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{overview.mau}</div><div className={pageStyles.statLabel}>MAU</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(overview.revenue)}</div><div className={pageStyles.statLabel}>30d Revenue</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{overview.totalOrders}</div><div className={pageStyles.statLabel}>30d Orders</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{overview.cancellationRate.toFixed(1)}%</div><div className={pageStyles.statLabel}>Cancellation</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{overview.refundRate.toFixed(1)}%</div><div className={pageStyles.statLabel}>Refund Rate</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(overview.aov)}</div><div className={pageStyles.statLabel}>AOV</div></div>
      </div>
      <div className={pageStyles.chartsRow}>
        <Card title="Revenue Trend">
          <TrendLineChart data={overview.revenueTrend} />
        </Card>
        <Card title="Revenue by Community">
          <RevenueBarChart data={communityChart} />
        </Card>
      </div>
      <Card title="Growth">
        <p>Total Customers: {overview.totalCustomers}</p>
        <p>Total Partners: {overview.totalPartners}</p>
        <p>Total Riders: {overview.totalRiders}</p>
      </Card>
    </div>
  );
};
