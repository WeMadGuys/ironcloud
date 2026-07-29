'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
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
import { formatRelativeTime } from '@/utils/format';

import { fetchCustomers } from '../services/customer.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type CustomerRow = Awaited<ReturnType<typeof fetchCustomers>>['data'][number];

const emptyForm = () => ({
  fullName: '',
  phone: '',
  email: '',
});

export const CustomersListPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const pageSize = 25;

  const createMutation = trpc.customers.create.useMutation();
  const updateMutation = trpc.customers.update.useMutation();
  const deleteMutation = trpc.customers.delete.useMutation();

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: ['admin-customers', page, pageSize, debouncedSearch],
    queryFn: () =>
      fetchCustomers({ page, pageSize, search: debouncedSearch || undefined }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const data = result?.data ?? [];
  const total = result?.total ?? 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
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

  const openEdit = (row: CustomerRow) => {
    setEditing(row);
    setForm({
      fullName: row.full_name ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    const phone = form.phone.replace(/\D/g, '');
    if (!form.fullName.trim() || phone.length !== 10) {
      toast('Full name and a 10-digit phone are required', 'error');
      return;
    }

    const payload = {
      fullName: form.fullName.trim(),
      phone,
      email: form.email.trim() || undefined,
    };

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('Customer updated', 'success');
            closeModal();
            invalidate();
          },
          onError: (err) => toast(err.message, 'error'),
        },
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast('Customer created', 'success');
        closeModal();
        invalidate();
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
          toast('Customer deleted', 'success');
          setDeleteId(null);
          invalidate();
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const refreshing = isFetching && !isLoading;

  if (isLoading && !result) return <Loader />;

  return (
    <div style={{ opacity: refreshing ? 0.85 : 1 }}>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search customers..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add Customer</Button>
        </div>
      </div>

      <div className={refreshing ? pageStyles.listRefreshing : undefined} aria-busy={refreshing}>
      {data.length === 0 ? (
        <EmptyState title="No customers found" />
      ) : (
        <>
          <Table
            columns={[
              {
                key: 'name',
                header: 'Name',
                render: (c) => <a href={`/admin/customers/${c.id}`}>{c.full_name ?? '—'}</a>,
              },
              { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
              { key: 'email', header: 'Email', render: (c) => c.email ?? '—' },
              {
                key: 'joined',
                header: 'Joined',
                render: (c) => formatRelativeTime(c.created_at),
              },
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
        title={editing ? 'Edit Customer' : 'Add Customer'}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create'}
        submitting={saving}
        submitDisabled={!form.fullName.trim() || form.phone.replace(/\D/g, '').length !== 10}
      >
        <div className={formStyles.stack}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="customer-name">
              Full name *
            </label>
            <input
              id="customer-name"
              className={formStyles.input}
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="customer-phone">
              Phone *
            </label>
            <input
              id="customer-phone"
              className={formStyles.input}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
              }
              placeholder="10-digit mobile"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="customer-email">
              Email
            </label>
            <input
              id="customer-email"
              className={formStyles.input}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        </div>
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete customer?"
        message="This permanently deletes the customer profile. Related orders may block deletion."
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
};
