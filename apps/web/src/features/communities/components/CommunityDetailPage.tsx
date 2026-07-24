'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button, Card, DetailBackLink, Loader, RevenueBarChart } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { ADMIN_ROUTES } from '@/constants/routes';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/utils/format';

import { fetchCommunityById } from '../services/communities.service';

import assignStyles from './CommunityDetailPage.module.css';
import pageStyles from '@/styles/pages.module.css';

const initials = (name: string | null | undefined) => {
  if (!name?.trim()) return 'R';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

export const CommunityDetailPage = () => {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [data, setData] = useState<Awaited<ReturnType<typeof fetchCommunityById>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRiderId, setSelectedRiderId] = useState('');

  const assignedQuery = trpc.riders.listByCommunity.useQuery(
    { communityId: id },
    { enabled: Boolean(id), refetchOnWindowFocus: false },
  );
  const optionsQuery = trpc.riders.listOptions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const assignMutation = trpc.riders.assignCommunity.useMutation({
    onSuccess: async () => {
      toast('Rider assigned', 'success');
      await utils.riders.listByCommunity.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const unassignMutation = trpc.riders.unassignCommunity.useMutation({
    onSuccess: async () => {
      toast('Rider removed', 'success');
      await utils.riders.listByCommunity.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  useEffect(() => {
    setLoading(true);
    fetchCommunityById(id).then((communityData) => {
      setData(communityData);
      setLoading(false);
    });
  }, [id]);

  const assignedRiders = assignedQuery.data ?? [];
  const assignedIds = useMemo(
    () => new Set(assignedRiders.map((row) => row.riderId)),
    [assignedRiders],
  );

  const availableRiders = useMemo(
    () => (optionsQuery.data ?? []).filter((rider) => !assignedIds.has(rider.id)),
    [optionsQuery.data, assignedIds],
  );

  useEffect(() => {
    if (!selectedRiderId && availableRiders.length > 0) {
      setSelectedRiderId(availableRiders[0].id);
      return;
    }
    if (selectedRiderId && !availableRiders.some((r) => r.id === selectedRiderId)) {
      setSelectedRiderId(availableRiders[0]?.id ?? '');
    }
  }, [availableRiders, selectedRiderId]);

  const handleAssign = () => {
    if (!selectedRiderId) return;
    assignMutation.mutate({ riderId: selectedRiderId, communityId: id });
  };

  const handleUnassign = (riderId: string) => {
    unassignMutation.mutate({ riderId, communityId: id });
  };

  if (loading) return <Loader fullPage />;
  if (!data?.community) return <div>Community not found</div>;

  const revenueChart = [{ name: data.community.name, revenue: data.revenue }];
  const towerChart = (data.towerRevenue ?? []).map((row) => ({
    name: row.tower,
    revenue: row.revenue,
  }));
  const isMutating = assignMutation.isPending || unassignMutation.isPending;
  const ridersLoading = assignedQuery.isLoading || assignedQuery.isFetching;

  return (
    <div>
      <DetailBackLink href={ADMIN_ROUTES.communities} label="Back to Communities" />

      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{data.customerCount}</div>
          <div className={pageStyles.statLabel}>Customers</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{data.orders.length}</div>
          <div className={pageStyles.statLabel}>Orders</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{formatCurrency(data.revenue)}</div>
          <div className={pageStyles.statLabel}>Revenue</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{assignedRiders.length}</div>
          <div className={pageStyles.statLabel}>Riders</div>
        </div>
      </div>

      <div className={pageStyles.detailGrid}>
        <Card
          title={data.community.name}
          subtitle={`${data.community.city} · ${data.community.status}`}
        >
          <RevenueBarChart data={revenueChart} />
        </Card>

        <Card
          title="Income by Tower"
          subtitle={
            towerChart.length === 0
              ? 'No tower data yet'
              : `${towerChart.length} tower${towerChart.length === 1 ? '' : 's'} with addresses/orders`
          }
        >
          {towerChart.length === 0 ? (
            <p className={assignStyles.statusLine}>No tower income to show yet.</p>
          ) : (
            <>
              <RevenueBarChart data={towerChart} />
              <ul className={assignStyles.towerList}>
                {(data.towerRevenue ?? []).map((row) => (
                  <li key={row.tower} className={assignStyles.towerItem}>
                    <span className={assignStyles.towerName}>{row.tower}</span>
                    <span className={assignStyles.towerMeta}>
                      {row.orders} order{row.orders === 1 ? '' : 's'}
                    </span>
                    <span className={assignStyles.towerRevenue}>
                      {formatCurrency(row.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card
          title="Assigned Riders"
          subtitle={
            ridersLoading
              ? 'Loading…'
              : `${assignedRiders.length} rider${assignedRiders.length === 1 ? '' : 's'} covering this community`
          }
        >
          <div className={assignStyles.assignPanel}>
            {ridersLoading && assignedRiders.length === 0 ? (
              <p className={assignStyles.statusLine}>Loading assigned riders…</p>
            ) : assignedRiders.length === 0 ? (
              <div className={assignStyles.emptyBox}>
                <p className={assignStyles.emptyTitle}>No riders assigned yet</p>
                <p className={assignStyles.emptyHint}>
                  Choose a rider below and click Assign to cover this community.
                </p>
              </div>
            ) : (
              <ul className={assignStyles.assignedList}>
                {assignedRiders.map((row) => (
                  <li key={row.riderId} className={assignStyles.assignedItem}>
                    <span className={assignStyles.avatar} aria-hidden>
                      {initials(row.fullName)}
                    </span>
                    <div className={assignStyles.assignedMeta}>
                      <Link
                        href={`${ADMIN_ROUTES.riders}/${row.riderId}`}
                        className={assignStyles.assignedName}
                      >
                        {row.fullName ?? 'Unknown rider'}
                      </Link>
                      <span className={assignStyles.assignedPhone}>{row.phone ?? 'No phone'}</span>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isMutating}
                      onClick={() => handleUnassign(row.riderId)}
                    >
                      {unassignMutation.isPending ? '…' : 'Remove'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className={assignStyles.assignBox}>
              <label className={assignStyles.assignLabel} htmlFor="assign-rider">
                Assign a rider
              </label>
              <div className={assignStyles.assignControls}>
                <select
                  id="assign-rider"
                  className={assignStyles.assignSelect}
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  disabled={availableRiders.length === 0 || isMutating || optionsQuery.isLoading}
                >
                  {optionsQuery.isLoading ? (
                    <option value="">Loading riders…</option>
                  ) : availableRiders.length === 0 ? (
                    <option value="">All riders already assigned</option>
                  ) : (
                    availableRiders.map((rider) => (
                      <option key={rider.id} value={rider.id}>
                        {rider.fullName ?? 'Rider'} ({rider.phone ?? '—'})
                      </option>
                    ))
                  )}
                </select>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedRiderId || isMutating || availableRiders.length === 0}
                >
                  {assignMutation.isPending ? 'Assigning…' : 'Assign'}
                </Button>
              </div>
              {assignedQuery.isError && (
                <p className={assignStyles.statusLine}>
                  Could not load assignments: {assignedQuery.error.message}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
