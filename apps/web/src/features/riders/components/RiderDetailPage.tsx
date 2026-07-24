'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Button, Card, Loader } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { ADMIN_ROUTES } from '@/constants/routes';
import { trpc } from '@/lib/trpc';

import { fetchRiderById } from '../services/riders.service';

import assignStyles from '@/features/communities/components/CommunityDetailPage.module.css';
import detailStyles from './RiderDetailPage.module.css';
import pageStyles from '@/styles/pages.module.css';

export const RiderDetailPage = () => {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [data, setData] = useState<Awaited<ReturnType<typeof fetchRiderById>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  const assignedQuery = trpc.riders.listCommunitiesForRider.useQuery(
    { riderId: id },
    { enabled: Boolean(id), refetchOnWindowFocus: false },
  );
  const optionsQuery = trpc.communities.listOptions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const assignMutation = trpc.riders.assignCommunity.useMutation({
    onSuccess: async () => {
      toast('Community assigned', 'success');
      await utils.riders.listCommunitiesForRider.invalidate({ riderId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const unassignMutation = trpc.riders.unassignCommunity.useMutation({
    onSuccess: async () => {
      toast('Community removed', 'success');
      await utils.riders.listCommunitiesForRider.invalidate({ riderId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  useEffect(() => {
    setLoading(true);
    fetchRiderById(id).then((riderData) => {
      setData(riderData);
      setLoading(false);
    });
  }, [id]);

  const assignedCommunities = assignedQuery.data ?? [];
  const assignedIds = useMemo(
    () => new Set(assignedCommunities.map((row) => row.communityId)),
    [assignedCommunities],
  );

  const availableCommunities = useMemo(
    () => (optionsQuery.data ?? []).filter((community) => !assignedIds.has(community.id)),
    [optionsQuery.data, assignedIds],
  );

  useEffect(() => {
    if (!selectedCommunityId && availableCommunities.length > 0) {
      setSelectedCommunityId(availableCommunities[0].id);
      return;
    }
    if (selectedCommunityId && !availableCommunities.some((c) => c.id === selectedCommunityId)) {
      setSelectedCommunityId(availableCommunities[0]?.id ?? '');
    }
  }, [availableCommunities, selectedCommunityId]);

  if (loading) return <Loader fullPage />;
  if (!data?.rider) return <div>Rider not found</div>;

  const profile = data.rider.profiles as { full_name: string; phone: string } | null;
  const isMutating = assignMutation.isPending || unassignMutation.isPending;

  return (
    <div className={pageStyles.detailGrid}>
      <div>
        <div className={pageStyles.statsGrid}>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{data.stats.totalJobs}</div>
            <div className={pageStyles.statLabel}>Total Jobs</div>
          </div>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{data.stats.completed}</div>
            <div className={pageStyles.statLabel}>Completed</div>
          </div>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{data.stats.pickupSuccess.toFixed(0)}%</div>
            <div className={pageStyles.statLabel}>Pickup Success</div>
          </div>
          <div className={pageStyles.statBox}>
            <div className={pageStyles.statValue}>{data.stats.deliverySuccess.toFixed(0)}%</div>
            <div className={pageStyles.statLabel}>Delivery Success</div>
          </div>
        </div>

        <Card title={profile?.full_name ?? 'Rider'}>
          <p>Phone: {profile?.phone}</p>
          <p>Rating: ★ {Number(data.rider.rating_avg).toFixed(1)}</p>
          <p>KYC: {data.rider.kyc_status}</p>
          {data.rider.vehicle_number && <p>Vehicle: {data.rider.vehicle_number}</p>}
          {data.rider.current_lat && (
            <p>
              Location: {data.rider.current_lat.toFixed(4)}, {data.rider.current_lng?.toFixed(4)}
            </p>
          )}

          <h4 className={detailStyles.sectionTitle}>Recent Jobs ({data.jobs.length})</h4>
          {data.jobs.length === 0 ? (
            <p className={detailStyles.emptyText}>No jobs yet.</p>
          ) : (
            data.jobs.slice(0, 10).map((j) => {
              const order = j.orders as { order_number: string } | null;
              return (
                <p key={j.id}>
                  {order?.order_number} — {j.job_type} — {j.status}
                </p>
              );
            })
          )}
        </Card>
      </div>

      <div>
        <Card
          title="Assigned Communities"
          subtitle={`${assignedCommunities.length} assigned`}
        >
          <div className={assignStyles.assignPanel}>
            {assignedCommunities.length === 0 ? (
              <div className={assignStyles.emptyBox}>
                <p className={assignStyles.emptyTitle}>No communities assigned yet</p>
                <p className={assignStyles.emptyHint}>
                  Choose a community below and click Assign.
                </p>
              </div>
            ) : (
              <ul className={assignStyles.assignedList}>
                {assignedCommunities.map((row) => (
                  <li key={row.communityId} className={assignStyles.assignedItem}>
                    <div className={assignStyles.assignedMeta}>
                      <Link
                        href={`${ADMIN_ROUTES.communities}/${row.communityId}`}
                        className={assignStyles.assignedName}
                      >
                        {row.name}
                      </Link>
                      <span className={assignStyles.assignedPhone}>{row.city}</span>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isMutating}
                      onClick={() =>
                        unassignMutation.mutate({ riderId: id, communityId: row.communityId })
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className={assignStyles.assignBox}>
              <label className={assignStyles.assignLabel} htmlFor="assign-community">
                Assign a community
              </label>
              <div className={assignStyles.assignControls}>
                <select
                  id="assign-community"
                  className={assignStyles.assignSelect}
                  value={selectedCommunityId}
                  onChange={(e) => setSelectedCommunityId(e.target.value)}
                  disabled={availableCommunities.length === 0 || isMutating}
                >
                  {availableCommunities.length === 0 ? (
                    <option value="">All communities assigned</option>
                  ) : (
                    availableCommunities.map((community) => (
                      <option key={community.id} value={community.id}>
                        {community.name} ({community.city})
                      </option>
                    ))
                  )}
                </select>
                <Button
                  onClick={() =>
                    assignMutation.mutate({
                      riderId: id,
                      communityId: selectedCommunityId,
                    })
                  }
                  disabled={!selectedCommunityId || isMutating}
                >
                  {assignMutation.isPending ? 'Assigning…' : 'Assign'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
