'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Badge,
  Button,
  ConfirmationDialog,
  CreateEntityModal,
  EmptyState,
  Loader,
  Pagination,
  SearchInput,
  Table,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { trpc } from '@/lib/trpc';

import type { CommunityStage } from '@ironcloud/db';

import { COMMUNITY_STAGES, stageBadge, stageLabel } from '../constants';
import { fetchCommunities, fetchCommunityOptions } from '../services/communities.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type CommunityRow = Awaited<ReturnType<typeof fetchCommunities>>['data'][number];

const formatDueDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const emptyForm = () => ({
  name: '',
  city: '',
  pricingTier: 'standard',
  stage: 'lead' as CommunityStage,
  blocksEnabled: false,
  addressLine: '',
  locality: '',
  pincode: '',
  state: '',
});

export const CommunitiesListPage = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [stageFilter, setStageFilter] = useState('');
  const [dueThisWeek, setDueThisWeek] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [data, setData] = useState<CommunityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommunityRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const pageSize = 25;

  const createMutation = trpc.communities.create.useMutation();
  const updateMutation = trpc.communities.update.useMutation();
  const deleteMutation = trpc.communities.delete.useMutation();

  const load = useCallback(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    fetchCommunities(page, pageSize, {
      search: debouncedSearch || undefined,
      stage: stageFilter || undefined,
      city: cityFilter || undefined,
      dueThisWeek,
      overdue: overdueOnly,
    }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    });
  }, [page, debouncedSearch, stageFilter, cityFilter, dueThisWeek, overdueOnly]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchCommunityOptions().then((options) => {
      const unique = new Set(options.map((option) => option.city?.trim()).filter(Boolean));
      setCities([...unique].sort((a, b) => a.localeCompare(b)));
    });
  }, []);

  const hasFilters = Boolean(stageFilter || cityFilter || dueThisWeek || overdueOnly);
  const clearFilters = () => {
    setStageFilter('');
    setCityFilter('');
    setDueThisWeek(false);
    setOverdueOnly(false);
    setPage(1);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row: CommunityRow) => {
    setEditing(row);
    setForm({
      name: row.name ?? '',
      city: row.city ?? '',
      pricingTier: row.pricing_tier ?? 'standard',
      stage: (row.stage as CommunityStage) || 'lead',
      blocksEnabled: Boolean(
        (row as { blocks_enabled?: boolean | null }).blocks_enabled,
      ),
      addressLine: row.address_line ?? '',
      locality: row.locality ?? '',
      pincode: row.pincode ?? '',
      state: row.state ?? '',
    });
    setModalOpen(true);
  };

  const pincodeInvalid = form.pincode.trim() !== '' && !/^\d{6}$/.test(form.pincode.trim());

  const handleSave = () => {
    if (!form.name.trim() || !form.city.trim()) {
      toast('Name and city are required', 'error');
      return;
    }
    if (pincodeInvalid) {
      toast('Pincode must be 6 digits', 'error');
      return;
    }

    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      pricingTier: form.pricingTier,
      stage: form.stage,
      blocksEnabled: form.blocksEnabled,
      addressLine: form.addressLine,
      locality: form.locality,
      pincode: form.pincode.trim(),
      state: form.state,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('Community updated', 'success');
            closeModal();
            load();
          },
          onError: (err) => toast(err.message, 'error'),
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast('Community created', 'success');
        closeModal();
        load();
      },
      onError: (err) => toast(err.message, 'error'),
    });
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast('Community deleted', 'success');
          setDeleteId(null);
          load();
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  if (loading) return <Loader fullPage />;

  return (
    <div>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search communities..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className={pageStyles.select}
          aria-label="Filter by stage"
          value={stageFilter}
          onChange={(e) => {
            setStageFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All stages</option>
          {COMMUNITY_STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
        <select
          className={pageStyles.select}
          aria-label="Filter by city"
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
        <label className={formStyles.checkLabel}>
          <input
            type="checkbox"
            checked={dueThisWeek}
            onChange={(e) => {
              setDueThisWeek(e.target.checked);
              setPage(1);
            }}
          />
          Next step due this week
        </label>
        <label className={formStyles.checkLabel}>
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => {
              setOverdueOnly(e.target.checked);
              setPage(1);
            }}
          />
          Overdue
        </label>
        {hasFilters ? (
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add Community</Button>
        </div>
      </div>

      <div className={refreshing ? pageStyles.listRefreshing : undefined} aria-busy={refreshing}>
      {data.length === 0 ? (
        <EmptyState title="No communities found" />
      ) : (
        <>
          <Table
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (c) => <a href={`/admin/communities/${c.id}`}>{c.name}</a>,
              },
              { key: 'city', header: 'City', render: (c) => c.city },
              { key: 'pincode', header: 'Pincode', render: (c) => c.pincode ?? '—' },
              {
                key: 'stage',
                header: 'Stage',
                render: (c) => <Badge variant={stageBadge(c.stage)}>{stageLabel(c.stage)}</Badge>,
              },
              {
                key: 'contact',
                header: 'Primary contact',
                render: (c) =>
                  c.primary_contact_name ? (
                    <span>
                      {c.primary_contact_name}
                      {c.primary_contact_position ? ` (${c.primary_contact_position})` : ''}
                      {c.primary_contact_phone ? (
                        <>
                          {' · '}
                          <a href={`tel:${c.primary_contact_phone}`}>{c.primary_contact_phone}</a>
                        </>
                      ) : null}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'nextStep',
                header: 'Next step',
                render: (c) =>
                  c.next_step_body ? (
                    <span>
                      {c.next_step_body}
                      {c.next_step_due ? (
                        <span
                          style={
                            c.overdue_steps_count > 0
                              ? { color: 'var(--ic-status-error)', fontWeight: 600 }
                              : undefined
                          }
                        >
                          {' · '}
                          {formatDueDate(c.next_step_due)}
                        </span>
                      ) : null}
                      {c.open_steps_count > 1 ? ` (+${c.open_steps_count - 1} more)` : ''}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              { key: 'tier', header: 'Pricing Tier', render: (c) => c.pricing_tier },
              {
                key: 'actions',
                header: 'Actions',
                render: (c) => (
                  <div className={formStyles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteId(c.id)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={data}
            keyExtractor={(c) => c.id}
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

      <CreateEntityModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Community' : 'Add Community'}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create'}
        submitting={saving}
        submitDisabled={!form.name.trim() || !form.city.trim() || pincodeInvalid}
      >
        <div className={formStyles.stack}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="community-name">
              Name *
            </label>
            <input
              id="community-name"
              className={formStyles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Community name"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="community-city">
              City *
            </label>
            <input
              id="community-city"
              className={formStyles.input}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="City"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="community-tier">
              Pricing tier
            </label>
            <select
              id="community-tier"
              className={formStyles.select}
              value={form.pricingTier}
              onChange={(e) => setForm((f) => ({ ...f, pricingTier: e.target.value }))}
            >
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="community-stage">
              Stage
            </label>
            <select
              id="community-stage"
              className={formStyles.select}
              value={form.stage}
              onChange={(e) =>
                setForm((f) => ({ ...f, stage: e.target.value as CommunityStage }))
              }
            >
              {COMMUNITY_STAGES.map((stage) => (
                <option key={stage.value} value={stage.value}>
                  {stage.label}
                </option>
              ))}
            </select>
            <p className={formStyles.hint}>
              Customers can only see and book this community once it is Active.
            </p>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="community-address">
              Address
            </label>
            <input
              id="community-address"
              className={formStyles.input}
              value={form.addressLine}
              onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
              placeholder="Street / road"
            />
          </div>
          <div className={formStyles.row2}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="community-locality">
                Locality / area
              </label>
              <input
                id="community-locality"
                className={formStyles.input}
                value={form.locality}
                onChange={(e) => setForm((f) => ({ ...f, locality: e.target.value }))}
                placeholder="e.g. Whitefield"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="community-pincode">
                Pincode
              </label>
              <input
                id="community-pincode"
                className={formStyles.input}
                value={form.pincode}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
                placeholder="560066"
              />
              {pincodeInvalid ? <p className={formStyles.error}>Pincode must be 6 digits</p> : null}
            </div>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="community-state">
              State
            </label>
            <input
              id="community-state"
              className={formStyles.input}
              value={form.state}
              onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              placeholder="e.g. Karnataka"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.checkLabel} htmlFor="community-blocks-enabled">
              <input
                id="community-blocks-enabled"
                type="checkbox"
                checked={form.blocksEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, blocksEnabled: e.target.checked }))
                }
              />
              Enable blocks
            </label>
            <p className={formStyles.hint}>
              When on, customers pick Block then Flat from a catalog. When off,
              they type tower/block and flat as free text.
            </p>
          </div>
        </div>
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete community?"
        message="This will permanently delete the community. Related data may block deletion."
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
};
