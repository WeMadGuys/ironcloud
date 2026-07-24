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

import { fetchPartners } from '../services/partner.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type PartnerRow = Awaited<ReturnType<typeof fetchPartners>>['data'][number];

const emptyForm = () => ({
  name: '',
  contactName: '',
  phone: '',
  email: '',
  city: '',
  capacity: '50',
});

export const PartnersListPage = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [data, setData] = useState<PartnerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const pageSize = 25;

  const createMutation = trpc.partners.create.useMutation();
  const updateMutation = trpc.partners.update.useMutation();
  const deleteMutation = trpc.partners.delete.useMutation();

  const load = useCallback(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    fetchPartners(page, pageSize, debouncedSearch || undefined).then((res) => {
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

  const openEdit = (row: PartnerRow) => {
    setEditing(row);
    setForm({
      name: row.name ?? '',
      contactName: row.contact_name ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      city: row.city ?? '',
      capacity: String(row.capacity ?? 50),
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast('Partner name is required', 'error');
      return;
    }

    const capacity = Number(form.capacity);
    const payload = {
      name: form.name.trim(),
      contactName: form.contactName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      city: form.city.trim() || undefined,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('Partner updated', 'success');
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
        toast('Partner created', 'success');
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
          toast('Partner deleted', 'success');
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
          placeholder="Search partners..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add Partner</Button>
        </div>
      </div>

      <div className={refreshing ? pageStyles.listRefreshing : undefined} aria-busy={refreshing}>
      {data.length === 0 ? (
        <EmptyState title="No partners found" />
      ) : (
        <>
          <Table
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (p) => <a href={`/admin/partners/${p.id}`}>{p.name}</a>,
              },
              { key: 'city', header: 'City', render: (p) => p.city ?? '—' },
              {
                key: 'rating',
                header: 'Rating',
                render: (p) => `★ ${Number(p.rating_avg).toFixed(1)}`,
              },
              {
                key: 'kyc',
                header: 'KYC',
                render: (p) => (
                  <Badge variant={p.kyc_status === 'approved' ? 'success' : 'warning'}>
                    {p.kyc_status}
                  </Badge>
                ),
              },
              {
                key: 'status',
                header: 'Verification',
                render: (p) => (
                  <Badge variant={p.verification_status === 'verified' ? 'success' : 'info'}>
                    {p.verification_status}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (p) => (
                  <div className={formStyles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteId(p.id)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={data}
            keyExtractor={(p) => p.id}
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
        title={editing ? 'Edit Partner' : 'Add Partner'}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create'}
        submitting={saving}
        submitDisabled={!form.name.trim()}
      >
        <div className={formStyles.stack}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="partner-name">
              Name *
            </label>
            <input
              id="partner-name"
              className={formStyles.input}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Partner name"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="partner-contact">
              Contact name
            </label>
            <input
              id="partner-contact"
              className={formStyles.input}
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
              placeholder="Contact person"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="partner-phone">
              Phone
            </label>
            <input
              id="partner-phone"
              className={formStyles.input}
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="Phone"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="partner-email">
              Email
            </label>
            <input
              id="partner-email"
              className={formStyles.input}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Email"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="partner-city">
              City
            </label>
            <input
              id="partner-city"
              className={formStyles.input}
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              placeholder="City"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="partner-capacity">
              Capacity
            </label>
            <input
              id="partner-capacity"
              className={formStyles.input}
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
            />
          </div>
        </div>
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete partner?"
        message="This permanently deletes the partner. Related assignments may block deletion."
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
};
