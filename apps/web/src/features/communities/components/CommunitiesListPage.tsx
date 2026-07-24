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

import { fetchCommunities } from '../services/communities.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type CommunityRow = Awaited<ReturnType<typeof fetchCommunities>>['data'][number];

const emptyForm = () => ({
  name: '',
  city: '',
  pricingTier: 'standard',
  status: 'active' as 'pending' | 'active' | 'suspended',
});

export const CommunitiesListPage = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
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

    fetchCommunities(page, pageSize, debouncedSearch || undefined).then((res) => {
      setData(res.data);
      setTotal(res.total);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    });
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

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
      status: (row.status as 'pending' | 'active' | 'suspended') || 'active',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.city.trim()) {
      toast('Name and city are required', 'error');
      return;
    }

    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      pricingTier: form.pricingTier,
      status: form.status,
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
              {
                key: 'status',
                header: 'Status',
                render: (c) => (
                  <Badge variant={c.status === 'active' ? 'success' : 'warning'}>{c.status}</Badge>
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
        submitDisabled={!form.name.trim() || !form.city.trim()}
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
            <label className={formStyles.label} htmlFor="community-status">
              Status
            </label>
            <select
              id="community-status"
              className={formStyles.select}
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as 'pending' | 'active' | 'suspended',
                }))
              }
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
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
