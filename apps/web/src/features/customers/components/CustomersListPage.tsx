'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Button,
  ConfirmationDialog,
  CreateEntityModal,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { trpc } from '@/lib/trpc';

import {
  CustomersGrid,
  type CustomerListRow,
} from './CustomersGrid';

import formStyles from '@/styles/form.module.css';

const emptyForm = () => ({
  fullName: '',
  phone: '',
  email: '',
});

export const CustomersListPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createMutation = trpc.customers.create.useMutation();
  const updateMutation = trpc.customers.update.useMutation();
  const deleteMutation = trpc.customers.delete.useMutation();

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

  const openEdit = (row: CustomerListRow) => {
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

  return (
    <div>
      <CustomersGrid
        mode="list"
        onEdit={openEdit}
        onDelete={(row) => setDeleteId(row.id)}
        toolbarEnd={<Button onClick={openCreate}>Add Customer</Button>}
      />

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
