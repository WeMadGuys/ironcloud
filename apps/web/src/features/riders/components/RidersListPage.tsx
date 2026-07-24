'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  ConfirmationDialog,
  CreateEntityModal,
  EmptyState,
  Loader,
  Pagination,
  Table,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { getSupabase } from '@/lib/supabase';
import { trpc } from '@/lib/trpc';

import { fetchRiders } from '../services/riders.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type RiderRow = Awaited<ReturnType<typeof fetchRiders>>['data'][number];

const emptyForm = () => ({
  fullName: '',
  phone: '',
  vehicleNumber: '',
  kycStatus: 'pending' as 'pending' | 'approved' | 'rejected',
});

export const RidersListPage = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RiderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RiderRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const pageSize = 25;

  const createMutation = trpc.riders.create.useMutation();
  const updateMutation = trpc.riders.update.useMutation();
  const deleteMutation = trpc.riders.delete.useMutation();

  const load = useCallback(() => {
    setLoading(true);
    fetchRiders(page, pageSize).then((res) => {
      setData(res.data);
      setTotal(res.total);
      setLoading(false);
    });
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel('admin-riders')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'riders' }, () => {
        fetchRiders(page, pageSize).then((res) => setData(res.data));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [page]);

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

  const openEdit = (row: RiderRow) => {
    const p = row.profiles as { full_name: string | null; phone: string | null } | null;
    setEditing(row);
    setForm({
      fullName: p?.full_name ?? '',
      phone: p?.phone ?? '',
      vehicleNumber: row.vehicle_number ?? '',
      kycStatus: (row.kyc_status as 'pending' | 'approved' | 'rejected') || 'pending',
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    const phone = form.phone.replace(/\D/g, '');
    if (!form.fullName.trim() || phone.length !== 10) {
      toast('Full name and a 10-digit phone are required', 'error');
      return;
    }

    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          fullName: form.fullName.trim(),
          phone,
          vehicleNumber: form.vehicleNumber.trim() || undefined,
          kycStatus: form.kycStatus,
        },
        {
          onSuccess: () => {
            toast('Rider updated', 'success');
            closeModal();
            load();
          },
          onError: (err) => toast(err.message, 'error'),
        },
      );
      return;
    }

    createMutation.mutate(
      {
        fullName: form.fullName.trim(),
        phone,
        vehicleNumber: form.vehicleNumber.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast('Rider created', 'success');
          closeModal();
          load();
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast('Rider deleted', 'success');
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
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add Rider</Button>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState title="No riders found" />
      ) : (
        <>
          <Table
            columns={[
              {
                key: 'name',
                header: 'Rider',
                render: (r) => {
                  const p = r.profiles as { full_name: string; phone: string } | null;
                  return <a href={`/admin/riders/${r.id}`}>{p?.full_name ?? '—'}</a>;
                },
              },
              {
                key: 'phone',
                header: 'Phone',
                render: (r) => (r.profiles as { phone: string } | null)?.phone ?? '—',
              },
              {
                key: 'rating',
                header: 'Rating',
                render: (r) => `★ ${Number(r.rating_avg).toFixed(1)}`,
              },
              { key: 'kyc', header: 'KYC', render: (r) => r.kyc_status },
              {
                key: 'location',
                header: 'Location',
                render: (r) =>
                  r.current_lat
                    ? `${r.current_lat.toFixed(4)}, ${r.current_lng?.toFixed(4)}`
                    : '—',
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (r) => (
                  <div className={formStyles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteId(r.id)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={data}
            keyExtractor={(r) => r.id}
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

      <CreateEntityModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Rider' : 'Add Rider'}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create'}
        submitting={saving}
        submitDisabled={!form.fullName.trim() || form.phone.replace(/\D/g, '').length !== 10}
      >
        <div className={formStyles.stack}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="rider-name">
              Full name *
            </label>
            <input
              id="rider-name"
              className={formStyles.input}
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="rider-phone">
              Phone *
            </label>
            <input
              id="rider-phone"
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
            <label className={formStyles.label} htmlFor="rider-vehicle">
              Vehicle number
            </label>
            <input
              id="rider-vehicle"
              className={formStyles.input}
              value={form.vehicleNumber}
              onChange={(e) => setForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          {editing && (
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="rider-kyc">
                KYC status
              </label>
              <select
                id="rider-kyc"
                className={formStyles.select}
                value={form.kycStatus}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    kycStatus: e.target.value as 'pending' | 'approved' | 'rejected',
                  }))
                }
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete rider?"
        message="This permanently deletes the rider profile and community assignments."
        confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
};
