'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button, Card, DetailBackLink, Loader, RevenueBarChart } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { ADMIN_ROUTES } from '@/constants/routes';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/utils/format';

import type { CommunityStage } from '@ironcloud/db';

import { stageLabel } from '../constants';
import { fetchCommunityById } from '../services/communities.service';

import { CommunityAddressCard } from './CommunityAddressCard';
import { CommunityContactsCard } from './CommunityContactsCard';
import { CommunityNextStepsCard } from './CommunityNextStepsCard';
import { CommunityPipelineCard } from './CommunityPipelineCard';
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
  const [selectedStartHour, setSelectedStartHour] = useState(8);
  const [communityClosedDate, setCommunityClosedDate] = useState('');
  const [newBlockName, setNewBlockName] = useState('');
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [newFlatsText, setNewFlatsText] = useState('');
  const [editingFlats, setEditingFlats] = useState(false);
  const seedEditFlatsRef = useRef(false);
  const [renameBlockId, setRenameBlockId] = useState<string | null>(null);
  const [renameBlockValue, setRenameBlockValue] = useState('');

  const assignedQuery = trpc.riders.listByCommunity.useQuery(
    { communityId: id },
    { enabled: Boolean(id), refetchOnWindowFocus: false },
  );
  const optionsQuery = trpc.riders.listOptions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const slotsQuery = trpc.communities.listPickupSlots.useQuery(
    { communityId: id },
    { enabled: Boolean(id), refetchOnWindowFocus: false },
  );
  const closedDatesQuery = trpc.communities.listClosedDates.useQuery(
    { communityId: id },
    { enabled: Boolean(id), refetchOnWindowFocus: false },
  );
  const blocksEnabled = Boolean(
    (data?.community as { blocks_enabled?: boolean } | null | undefined)
      ?.blocks_enabled,
  );
  const blocksQuery = trpc.communities.listBlocks.useQuery(
    { communityId: id },
    { enabled: Boolean(id) && blocksEnabled, refetchOnWindowFocus: false },
  );
  const flatsQuery = trpc.communities.listFlats.useQuery(
    { blockId: expandedBlockId ?? '' },
    { enabled: Boolean(expandedBlockId) && blocksEnabled, refetchOnWindowFocus: false },
  );

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

  const addSlotMutation = trpc.communities.addPickupSlot.useMutation({
    onSuccess: async () => {
      toast('Pickup slot added', 'success');
      await utils.communities.listPickupSlots.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const setSlotActiveMutation = trpc.communities.setPickupSlotActive.useMutation({
    onSuccess: async () => {
      await utils.communities.listPickupSlots.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const removeSlotMutation = trpc.communities.removePickupSlot.useMutation({
    onSuccess: async () => {
      toast('Pickup slot removed', 'success');
      await utils.communities.listPickupSlots.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const addClosedDateMutation = trpc.communities.addClosedDate.useMutation({
    onSuccess: async () => {
      toast('Closed date added', 'success');
      setCommunityClosedDate('');
      await utils.communities.listClosedDates.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const removeClosedDateMutation = trpc.communities.removeClosedDate.useMutation({
    onSuccess: async () => {
      toast('Closed date removed', 'success');
      await utils.communities.listClosedDates.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const createBlockMutation = trpc.communities.createBlock.useMutation({
    onSuccess: async () => {
      toast('Block added', 'success');
      setNewBlockName('');
      await utils.communities.listBlocks.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const updateBlockMutation = trpc.communities.updateBlock.useMutation({
    onSuccess: async () => {
      toast('Block updated', 'success');
      setRenameBlockId(null);
      setRenameBlockValue('');
      await utils.communities.listBlocks.invalidate({ communityId: id });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const createFlatsMutation = trpc.communities.createFlats.useMutation({
    onSuccess: async (result) => {
      toast(
        result.created === 1
          ? '1 flat added'
          : `${result.created} flats added`,
        'success',
      );
      setNewFlatsText('');
      if (expandedBlockId) {
        await utils.communities.listFlats.invalidate({ blockId: expandedBlockId });
      }
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const updateFlatMutation = trpc.communities.updateFlat.useMutation({
    onSuccess: async () => {
      if (expandedBlockId) {
        await utils.communities.listFlats.invalidate({ blockId: expandedBlockId });
      }
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const syncFlatsMutation = trpc.communities.syncFlats.useMutation({
    onSuccess: async () => {
      toast('Flats updated', 'success');
      setEditingFlats(false);
      setNewFlatsText('');
      seedEditFlatsRef.current = false;
      if (expandedBlockId) {
        await utils.communities.listFlats.invalidate({ blockId: expandedBlockId });
      }
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const setBlocksEnabledMutation = trpc.communities.update.useMutation({
    onSuccess: async (_result, variables) => {
      const enabled = Boolean(variables.blocksEnabled);
      toast(
        enabled ? 'Blocks enabled for this community' : 'Blocks disabled — free-text address fields restored',
        'success',
      );
      const communityData = await fetchCommunityById(id);
      setData(communityData);
      if (enabled) {
        await utils.communities.listBlocks.invalidate({ communityId: id });
      } else {
        setExpandedBlockId(null);
        setEditingFlats(false);
        setNewFlatsText('');
        seedEditFlatsRef.current = false;
      }
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

  const reloadCommunity = () => {
    fetchCommunityById(id).then(setData);
  };

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

  useEffect(() => {
    const taken = new Set((slotsQuery.data ?? []).map((slot) => slot.start_hour));
    const available = Array.from({ length: 24 }, (_, hour) => hour).filter(
      (hour) => !taken.has(hour),
    );
    if (available.length === 0) return;
    if (!available.includes(selectedStartHour)) {
      setSelectedStartHour(available[0]);
    }
  }, [slotsQuery.data, selectedStartHour]);

  const handleAssign = () => {
    if (!selectedRiderId) return;
    assignMutation.mutate({ riderId: selectedRiderId, communityId: id });
  };

  const handleUnassign = (riderId: string) => {
    unassignMutation.mutate({ riderId, communityId: id });
  };

  const formatHourLabel = (startHour: number) => {
    const start = new Date();
    start.setHours(startHour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(startHour + 1, 0, 0, 0);
    const opts: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    return `${start.toLocaleTimeString('en-US', opts)} – ${end.toLocaleTimeString('en-US', opts)}`;
  };

  const handleAddSlot = () => {
    addSlotMutation.mutate({ communityId: id, startHour: selectedStartHour });
  };

  const parseFlatNumbers = (raw: string) =>
    raw
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);

  const handleAddBlock = () => {
    const name = newBlockName.trim();
    if (!name) return;
    createBlockMutation.mutate({ communityId: id, name });
  };

  const resetFlatsEditor = () => {
    setEditingFlats(false);
    setNewFlatsText('');
    seedEditFlatsRef.current = false;
  };

  const startEditFlats = (
    blockId: string,
    currentFlats?: { flat_number: string }[],
  ) => {
    setExpandedBlockId(blockId);
    setEditingFlats(true);
    if (currentFlats) {
      setNewFlatsText(currentFlats.map((flat) => flat.flat_number).join(', '));
      seedEditFlatsRef.current = false;
      return;
    }
    setNewFlatsText('');
    seedEditFlatsRef.current = true;
  };

  useEffect(() => {
    if (!editingFlats || !seedEditFlatsRef.current) return;
    if (!flatsQuery.data || flatsQuery.isLoading) return;
    setNewFlatsText(flatsQuery.data.map((flat) => flat.flat_number).join(', '));
    seedEditFlatsRef.current = false;
  }, [editingFlats, flatsQuery.data, flatsQuery.isLoading]);

  const handleAddFlats = () => {
    if (!expandedBlockId) return;
    const flatNumbers = parseFlatNumbers(newFlatsText);
    if (flatNumbers.length === 0) {
      toast('Enter at least one flat number', 'error');
      return;
    }
    createFlatsMutation.mutate({
      communityId: id,
      blockId: expandedBlockId,
      flatNumbers,
    });
  };

  const handleSaveFlats = () => {
    if (!expandedBlockId) return;
    const flatNumbers = parseFlatNumbers(newFlatsText);
    if (flatNumbers.length === 0) {
      toast('Enter at least one flat number', 'error');
      return;
    }
    syncFlatsMutation.mutate({
      communityId: id,
      blockId: expandedBlockId,
      flatNumbers,
    });
  };

  if (loading) return <Loader fullPage />;
  if (!data?.community) return <div>Community not found</div>;

  const revenueChart = [{ name: data.community.name, revenue: data.revenue }];
  const towerChart = (data.towerRevenue ?? []).map((row) => ({
    name: row.tower,
    revenue: row.revenue,
  }));
  const isMutating = assignMutation.isPending || unassignMutation.isPending;
  const isSlotMutating =
    addSlotMutation.isPending ||
    setSlotActiveMutation.isPending ||
    removeSlotMutation.isPending;
  const isClosedDateMutating =
    addClosedDateMutation.isPending || removeClosedDateMutation.isPending;
  const closedDates = closedDatesQuery.data ?? [];
  const communityOnlyClosedDates = closedDates.filter((row) => row.scope === 'community');
  const globalClosedDates = closedDates.filter((row) => row.scope === 'global');
  const formatClosedDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  const isBlockMutating =
    createBlockMutation.isPending ||
    updateBlockMutation.isPending ||
    createFlatsMutation.isPending ||
    updateFlatMutation.isPending ||
    syncFlatsMutation.isPending ||
    setBlocksEnabledMutation.isPending;
  const ridersLoading = assignedQuery.isLoading || assignedQuery.isFetching;
  const pickupSlots = slotsQuery.data ?? [];
  const communityBlocks = blocksQuery.data ?? [];
  const blockFlats = flatsQuery.data ?? [];
  const takenHours = new Set(pickupSlots.map((slot) => slot.start_hour));
  const availableHours = Array.from({ length: 24 }, (_, hour) => hour).filter(
    (hour) => !takenHours.has(hour),
  );

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
        <CommunityPipelineCard
          communityId={id}
          stage={data.community.stage as CommunityStage}
          stageUpdatedAt={data.community.stage_updated_at ?? null}
          onStageChanged={reloadCommunity}
        />
        <CommunityContactsCard communityId={id} />
        <CommunityNextStepsCard communityId={id} />
        <CommunityAddressCard
          communityId={id}
          community={data.community}
          onSaved={reloadCommunity}
        />

        <Card
          title={data.community.name}
          subtitle={`${data.community.city} · ${stageLabel(data.community.stage)}${
            blocksEnabled ? ' · Blocks enabled' : ''
          }`}
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

        <Card
          title="Pickup Slots"
          subtitle={
            slotsQuery.isLoading
              ? 'Loading…'
              : `${pickupSlots.length} hourly slot${pickupSlots.length === 1 ? '' : 's'} · customers only see active ones`
          }
        >
          <div className={assignStyles.assignPanel}>
            {slotsQuery.isLoading && pickupSlots.length === 0 ? (
              <p className={assignStyles.statusLine}>Loading pickup slots…</p>
            ) : pickupSlots.length === 0 ? (
              <div className={assignStyles.emptyBox}>
                <p className={assignStyles.emptyTitle}>No pickup slots yet</p>
                <p className={assignStyles.emptyHint}>
                  Add hourly windows below. Each community can have its own schedule.
                </p>
              </div>
            ) : (
              <ul className={assignStyles.assignedList}>
                {pickupSlots.map((slot) => (
                  <li key={slot.id} className={assignStyles.assignedItem}>
                    <div className={assignStyles.assignedMeta}>
                      <span className={assignStyles.assignedName}>
                        {formatHourLabel(slot.start_hour)}
                      </span>
                      <span className={assignStyles.assignedPhone}>
                        Capacity {slot.capacity}
                        {slot.is_active ? '' : ' · Inactive'}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSlotMutating}
                      onClick={() =>
                        setSlotActiveMutation.mutate({
                          id: slot.id,
                          communityId: id,
                          isActive: !slot.is_active,
                        })
                      }
                    >
                      {slot.is_active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isSlotMutating}
                      onClick={() =>
                        removeSlotMutation.mutate({ id: slot.id, communityId: id })
                      }
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className={assignStyles.assignBox}>
              <label className={assignStyles.assignLabel} htmlFor="add-pickup-slot">
                Add hourly slot
              </label>
              <div className={assignStyles.assignControls}>
                <select
                  id="add-pickup-slot"
                  className={assignStyles.assignSelect}
                  value={availableHours.includes(selectedStartHour) ? selectedStartHour : availableHours[0] ?? ''}
                  onChange={(e) => setSelectedStartHour(Number(e.target.value))}
                  disabled={availableHours.length === 0 || isSlotMutating}
                >
                  {availableHours.length === 0 ? (
                    <option value="">All hours already added</option>
                  ) : (
                    availableHours.map((hour) => (
                      <option key={hour} value={hour}>
                        {formatHourLabel(hour)}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  onClick={handleAddSlot}
                  disabled={
                    availableHours.length === 0 ||
                    isSlotMutating ||
                    !Number.isInteger(selectedStartHour)
                  }
                >
                  {addSlotMutation.isPending ? 'Adding…' : 'Add slot'}
                </Button>
              </div>
              {slotsQuery.isError && (
                <p className={assignStyles.statusLine}>
                  Could not load slots: {slotsQuery.error.message}
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card
          title="Closed dates"
          subtitle="Hide all pickup slots for this community on selected dates"
        >
          <div className={assignStyles.assignPanel}>
            {closedDatesQuery.isLoading ? (
              <p className={assignStyles.statusLine}>Loading closed dates…</p>
            ) : (
              <>
                {globalClosedDates.length > 0 ? (
                  <ul className={assignStyles.assignedList}>
                    {globalClosedDates.map((row) => (
                      <li key={row.id} className={assignStyles.assignedItem}>
                        <div className={assignStyles.assignedMeta}>
                          <span className={assignStyles.assignedName}>
                            {formatClosedDate(row.closed_date)}
                          </span>
                          <span className={assignStyles.assignedPhone}>
                            All communities · managed on communities list
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {communityOnlyClosedDates.length === 0 ? (
                  <div className={assignStyles.emptyBox}>
                    <p className={assignStyles.emptyTitle}>No community closed dates</p>
                    <p className={assignStyles.emptyHint}>
                      Add a date below to hide slots for this community only.
                    </p>
                  </div>
                ) : (
                  <ul className={assignStyles.assignedList}>
                    {communityOnlyClosedDates.map((row) => (
                      <li key={row.id} className={assignStyles.assignedItem}>
                        <div className={assignStyles.assignedMeta}>
                          <span className={assignStyles.assignedName}>
                            {formatClosedDate(row.closed_date)}
                          </span>
                          <span className={assignStyles.assignedPhone}>This community</span>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isClosedDateMutating}
                          onClick={() => removeClosedDateMutation.mutate({ id: row.id })}
                        >
                          Enable
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <div className={assignStyles.assignBox}>
              <label className={assignStyles.assignLabel} htmlFor="add-closed-date">
                Disable a date
              </label>
              <div className={assignStyles.assignControls}>
                <input
                  id="add-closed-date"
                  type="date"
                  className={assignStyles.assignSelect}
                  value={communityClosedDate}
                  onChange={(e) => setCommunityClosedDate(e.target.value)}
                  disabled={isClosedDateMutating}
                />
                <Button
                  onClick={() => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(communityClosedDate)) {
                      toast('Pick a valid date', 'error');
                      return;
                    }
                    addClosedDateMutation.mutate({
                      communityId: id,
                      closedDate: communityClosedDate,
                    });
                  }}
                  disabled={!communityClosedDate || isClosedDateMutating}
                >
                  {addClosedDateMutation.isPending ? 'Adding…' : 'Disable date'}
                </Button>
              </div>
              {closedDatesQuery.isError && (
                <p className={assignStyles.statusLine}>
                  Could not load closed dates: {closedDatesQuery.error.message}
                </p>
              )}
            </div>
          </div>
        </Card>

        {blocksEnabled ? (
          <Card
            title="Blocks & Flats"
            subtitle={
              blocksQuery.isLoading
                ? 'Loading…'
                : `${communityBlocks.length} block${communityBlocks.length === 1 ? '' : 's'} · customers pick from active catalog`
            }
          >
            <div className={assignStyles.assignPanel}>
              <div className={assignStyles.toggleRow}>
                <label className={assignStyles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={blocksEnabled}
                    disabled={isBlockMutating}
                    onChange={(e) => {
                      const community = data.community;
                      setBlocksEnabledMutation.mutate({
                        id,
                        name: community.name,
                        city: community.city,
                        pricingTier: community.pricing_tier ?? 'standard',
                        blocksEnabled: e.target.checked,
                      });
                    }}
                  />
                  Enable blocks
                </label>
                <p className={assignStyles.toggleHint}>
                  Customers must pick Block then Flat from the lists below.
                </p>
              </div>
              {blocksQuery.isLoading && communityBlocks.length === 0 ? (
                <p className={assignStyles.statusLine}>Loading blocks…</p>
              ) : communityBlocks.length === 0 ? (
                <div className={assignStyles.emptyBox}>
                  <p className={assignStyles.emptyTitle}>No blocks yet</p>
                  <p className={assignStyles.emptyHint}>
                    Add blocks below, then open a block to add flats.
                  </p>
                </div>
              ) : (
                <ul className={assignStyles.assignedList}>
                  {communityBlocks.map((block) => {
                    const isExpanded = expandedBlockId === block.id;
                    const isRenaming = renameBlockId === block.id;
                    return (
                      <li key={block.id} className={assignStyles.blockItem}>
                        <div className={assignStyles.assignedItem}>
                          <div className={assignStyles.assignedMeta}>
                            {isRenaming ? (
                              <input
                                className={assignStyles.assignSelect}
                                value={renameBlockValue}
                                onChange={(e) => setRenameBlockValue(e.target.value)}
                                aria-label="Rename block"
                              />
                            ) : (
                              <span className={assignStyles.assignedName}>
                                {block.name}
                                {block.is_active ? '' : ' · Inactive'}
                              </span>
                            )}
                          </div>
                          {isRenaming ? (
                            <>
                              <Button
                                size="sm"
                                disabled={isBlockMutating || !renameBlockValue.trim()}
                                onClick={() =>
                                  updateBlockMutation.mutate({
                                    id: block.id,
                                    communityId: id,
                                    name: renameBlockValue.trim(),
                                  })
                                }
                              >
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBlockMutating}
                                onClick={() => {
                                  setRenameBlockId(null);
                                  setRenameBlockValue('');
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBlockMutating}
                                onClick={() => {
                                  setExpandedBlockId(isExpanded ? null : block.id);
                                  resetFlatsEditor();
                                }}
                              >
                                {isExpanded ? 'Hide flats' : 'Flats'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBlockMutating}
                                onClick={() =>
                                  startEditFlats(
                                    block.id,
                                    isExpanded ? flatsQuery.data : undefined,
                                  )
                                }
                              >
                                Edit flats
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBlockMutating}
                                onClick={() => {
                                  setRenameBlockId(block.id);
                                  setRenameBlockValue(block.name);
                                }}
                              >
                                Rename
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBlockMutating}
                                onClick={() =>
                                  updateBlockMutation.mutate({
                                    id: block.id,
                                    communityId: id,
                                    isActive: !block.is_active,
                                  })
                                }
                              >
                                {block.is_active ? 'Disable' : 'Enable'}
                              </Button>
                            </>
                          )}
                        </div>

                        {isExpanded ? (
                          <div className={assignStyles.flatsPanel}>
                            {flatsQuery.isLoading ? (
                              <p className={assignStyles.statusLine}>Loading flats…</p>
                            ) : blockFlats.length === 0 ? (
                              <p className={assignStyles.emptyHint}>
                                No flats in this block yet.
                              </p>
                            ) : (
                              <ul className={assignStyles.flatList}>
                                {blockFlats.map((flat) => (
                                  <li key={flat.id} className={assignStyles.flatItem}>
                                    <span>
                                      {flat.flat_number}
                                      {flat.is_active ? '' : ' · Inactive'}
                                    </span>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      disabled={isBlockMutating}
                                      onClick={() =>
                                        updateFlatMutation.mutate({
                                          id: flat.id,
                                          blockId: block.id,
                                          communityId: id,
                                          isActive: !flat.is_active,
                                        })
                                      }
                                    >
                                      {flat.is_active ? 'Disable' : 'Enable'}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <label
                              className={assignStyles.assignLabel}
                              htmlFor={`add-flats-${block.id}`}
                            >
                              {editingFlats
                                ? 'Edit flats (comma or newline separated)'
                                : 'Add flats (comma or newline separated)'}
                            </label>
                            <textarea
                              id={`add-flats-${block.id}`}
                              className={assignStyles.flatsInput}
                              rows={editingFlats ? 8 : 3}
                              value={newFlatsText}
                              onChange={(e) => setNewFlatsText(e.target.value)}
                              placeholder="101, 102, 103"
                            />
                            {editingFlats ? (
                              <div className={assignStyles.assignControls}>
                                <Button
                                  onClick={handleSaveFlats}
                                  disabled={isBlockMutating || !newFlatsText.trim()}
                                >
                                  {syncFlatsMutation.isPending ? 'Saving…' : 'Save flats'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  disabled={isBlockMutating}
                                  onClick={resetFlatsEditor}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                onClick={handleAddFlats}
                                disabled={isBlockMutating || !newFlatsText.trim()}
                              >
                                {createFlatsMutation.isPending ? 'Adding…' : 'Add flats'}
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className={assignStyles.assignBox}>
                <label className={assignStyles.assignLabel} htmlFor="add-block">
                  Add block
                </label>
                <div className={assignStyles.assignControls}>
                  <input
                    id="add-block"
                    className={assignStyles.assignSelect}
                    value={newBlockName}
                    onChange={(e) => setNewBlockName(e.target.value)}
                    placeholder="e.g. Tower A"
                    disabled={isBlockMutating}
                  />
                  <Button
                    onClick={handleAddBlock}
                    disabled={isBlockMutating || !newBlockName.trim()}
                  >
                    {createBlockMutation.isPending ? 'Adding…' : 'Add block'}
                  </Button>
                </div>
                {blocksQuery.isError ? (
                  <p className={assignStyles.statusLine}>
                    Could not load blocks: {blocksQuery.error.message}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        ) : (
          <Card
            title="Blocks & Flats"
            subtitle="Off — customers type tower/block and flat as free text"
          >
            <div className={assignStyles.assignPanel}>
              <div className={assignStyles.toggleRow}>
                <label className={assignStyles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={isBlockMutating}
                    onChange={(e) => {
                      if (!e.target.checked) return;
                      const community = data.community;
                      setBlocksEnabledMutation.mutate({
                        id,
                        name: community.name,
                        city: community.city,
                        pricingTier: community.pricing_tier ?? 'standard',
                        blocksEnabled: true,
                      });
                    }}
                  />
                  Enable blocks
                </label>
                <p className={assignStyles.toggleHint}>
                  Turn this on to define blocks and flats. Customers will then
                  pick from those lists instead of typing freely.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
