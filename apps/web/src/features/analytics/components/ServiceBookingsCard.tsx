'use client';

import { SERVICE_LINES } from '@ironcloud/db';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { Card, Loader, StackedBarChart } from '@/components';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import {
  SERVICE_BOOKING_DATE_PRESET_OPTIONS,
  dateRangeKey,
  resolveOrderDateRange,
  type OrderDatePreset,
} from '@/features/orders/utils/datePresets';

import {
  fetchServiceBookingSource,
  summarizeServiceBookings,
  type OrderExclusion,
} from '../services/analytics.service';

import pageStyles from '@/styles/pages.module.css';
import styles from './ServiceBookingsCard.module.css';

const STACK_COLORS = [
  'var(--ic-chart-1)',
  'var(--ic-chart-2)',
  'var(--ic-chart-3)',
  'var(--ic-chart-4)',
  'var(--ic-chart-5)',
  'var(--ic-chart-6)',
];

const EMPTY_COPY = 'No bookings in this period.';

export const ServiceBookingsCard = ({ exclusion }: { exclusion: OrderExclusion }) => {
  const [preset, setPreset] = useState<OrderDatePreset>('this_month');
  const [communityId, setCommunityId] = useState('');
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<string> | null>(null);

  useEffect(() => {
    void fetchCommunityOptions().then(setCommunities);
  }, []);

  const range = useMemo(() => resolveOrderDateRange(preset), [preset]);
  const rangeKey = dateRangeKey(preset);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-service-bookings', rangeKey, communityId || 'all'],
    queryFn: () =>
      fetchServiceBookingSource(
        { from: range.from as Date, to: range.to as Date },
        communityId || undefined,
      ),
    enabled: Boolean(range.from && range.to),
    staleTime: 45_000,
  });

  const summary = useMemo(() => {
    if (!data) return null;
    return summarizeServiceBookings(data.orders, data.services, exclusion);
  }, [data, exclusion]);

  const lineOptions = summary?.lines ?? SERVICE_LINES.map((line) => ({ id: line.id, label: line.label }));

  const toggleLine = (id: string) => {
    setSelectedLines((current) => {
      const next = new Set(current ?? lineOptions.map((line) => line.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chart = useMemo(() => {
    const active = new Set(selectedLines ?? lineOptions.map((line) => line.id));
    const series = lineOptions
      .map((line, index) => ({
        key: line.id,
        label: line.label,
        color: STACK_COLORS[index % STACK_COLORS.length],
      }))
      .filter((line) => active.has(line.key));

    const rows = (summary?.bars ?? [])
      .map((bar) => {
        const row: Record<string, string | number> = { name: bar.name };
        let total = 0;
        for (const line of series) {
          const qty = bar.segments[line.key] ?? 0;
          row[line.key] = qty;
          total += qty;
        }
        row.total = total;
        return row;
      })
      .filter((row) => Number(row.total) > 0)
      .sort(
        (a, b) =>
          Number(b.total) - Number(a.total) || String(a.name).localeCompare(String(b.name)),
      );

    return { series, rows };
  }, [lineOptions, selectedLines, summary]);

  return (
    <Card
      title="Bookings by service"
      subtitle="Pieces booked for each garment, stacked by service line"
      className={styles.card}
    >
      <div className={pageStyles.filters}>
        <select
          className={pageStyles.select}
          value={preset}
          aria-label="Booking period"
          onChange={(e) => setPreset(e.target.value as OrderDatePreset)}
        >
          {SERVICE_BOOKING_DATE_PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className={pageStyles.select}
          value={communityId}
          aria-label="Filter by community"
          onChange={(e) => setCommunityId(e.target.value)}
        >
          <option value="">All communities</option>
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              {community.name}
            </option>
          ))}
        </select>
        {lineOptions.map((line) => {
          const checked = selectedLines === null || selectedLines.has(line.id);
          return (
            <label key={line.id} className={pageStyles.checkLabel}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleLine(line.id)}
              />
              {line.label}
            </label>
          );
        })}
      </div>
      <div style={{ opacity: isFetching && !isLoading ? 0.85 : 1 }}>
        {isLoading && !data ? (
          <Loader />
        ) : chart.rows.length === 0 || chart.series.length === 0 ? (
          <p className={styles.empty}>{EMPTY_COPY}</p>
        ) : (
          <StackedBarChart data={chart.rows} series={chart.series} />
        )}
      </div>
    </Card>
  );
};
