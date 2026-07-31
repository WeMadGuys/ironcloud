'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  Card,
  ConfirmationDialog,
  CreateEntityModal,
  Loader,
  Modal,
  Table,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { CustomersGrid } from '@/features/customers/components/CustomersGrid';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import { trpc } from '@/lib/trpc';
import { formatCurrency } from '@/utils/format';
import type { PricingScope } from '@ironcloud/db';

import {
  fetchActiveServices,
  fetchPricingRules,
} from '../services/settings.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type PricingRow = Awaited<ReturnType<typeof fetchPricingRules>>[number];
type ServiceOption = Awaited<ReturnType<typeof fetchActiveServices>>[number];

type PricingForm = {
  serviceId: string;
  scope: PricingScope;
  city: string;
  communityId: string;
  userId: string;
  userLabel: string;
  basePrice: string;
  expressMultiplier: string;
};

const emptyForm = (): PricingForm => ({
  serviceId: '',
  scope: 'all',
  city: '',
  communityId: '',
  userId: '',
  userLabel: '',
  basePrice: '',
  expressMultiplier: '1.5',
});

function scopeLabel(scope: string | null | undefined): string {
  switch (scope) {
    case 'city':
      return 'City';
    case 'community':
      return 'Community';
    case 'user':
      return 'User';
    default:
      return 'All';
  }
}

function targetLabel(row: PricingRow): string {
  const scope = (row.scope as string | null) ?? (row.community_id ? 'community' : 'all');
  if (scope === 'city') return row.city?.trim() || '—';
  if (scope === 'community') {
    return (row.communities as { name: string } | null)?.name ?? '—';
  }
  if (scope === 'user') {
    const profile = row.profiles as { full_name: string; phone: string | null } | null;
    if (!profile) return row.user_id?.slice(0, 8) ?? '—';
    return profile.phone
      ? `${profile.full_name} (${profile.phone})`
      : profile.full_name;
  }
  return 'All communities';
}

export const PricingRulesPanel = () => {
  const toast = useToast();
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRow | null>(null);
  const [form, setForm] = useState<PricingForm>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());

  const createPricing = trpc.settings.createPricing.useMutation();
  const updatePricing = trpc.settings.updatePricing.useMutation();
  const deletePricing = trpc.settings.deletePricing.useMutation();

  const load = async () => {
    const [rules, svc, communityOpts] = await Promise.all([
      fetchPricingRules(),
      fetchActiveServices(),
      fetchCommunityOptions(),
    ]);
    setPricing(rules);
    setServices(svc);
    setCommunities(communityOpts);
  };

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, []);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of communities) {
      if (c.city?.trim()) set.add(c.city.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [communities]);

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

  const openEdit = (row: PricingRow) => {
    const scope = ((row.scope as PricingScope | null) ??
      (row.community_id ? 'community' : 'all')) as PricingScope;
    const profile = row.profiles as { full_name: string; phone: string | null } | null;
    setEditing(row);
    setForm({
      serviceId: row.service_id,
      scope,
      city: row.city ?? '',
      communityId: row.community_id ?? '',
      userId: row.user_id ?? '',
      userLabel: profile
        ? profile.phone
          ? `${profile.full_name} (${profile.phone})`
          : profile.full_name
        : '',
      basePrice: String(row.base_price ?? ''),
      expressMultiplier: String(row.express_multiplier ?? 1.5),
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.serviceId) {
      toast('Select a service', 'error');
      return;
    }
    const basePrice = Number(form.basePrice);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      toast('Enter a valid base price', 'error');
      return;
    }
    if (form.scope === 'city' && !form.city.trim()) {
      toast('Select a city', 'error');
      return;
    }
    if (form.scope === 'community' && !form.communityId) {
      toast('Select a community', 'error');
      return;
    }
    if (form.scope === 'user' && !form.userId) {
      toast('Select a customer', 'error');
      return;
    }

    const expressMultiplier = Number(form.expressMultiplier);
    const payload = {
      serviceId: form.serviceId,
      scope: form.scope,
      city: form.scope === 'city' ? form.city.trim() : null,
      communityId: form.scope === 'community' ? form.communityId : null,
      userId: form.scope === 'user' ? form.userId : null,
      basePrice,
      expressMultiplier:
        Number.isFinite(expressMultiplier) && expressMultiplier > 0
          ? expressMultiplier
          : 1.5,
    };

    if (editing) {
      updatePricing.mutate(
        { id: editing.id, ...payload },
        {
          onSuccess: () => {
            toast('Pricing rule updated', 'success');
            closeModal();
            void load();
          },
          onError: (err) => toast(err.message, 'error'),
        },
      );
    } else {
      createPricing.mutate(payload, {
        onSuccess: () => {
          toast('Pricing rule created', 'success');
          closeModal();
          void load();
        },
        onError: (err) => toast(err.message, 'error'),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deletePricing.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast('Pricing rule deleted', 'success');
          setDeleteId(null);
          void load();
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  if (loading) return <Loader />;

  const submitting = createPricing.isPending || updatePricing.isPending;

  return (
    <>
      <div className={pageStyles.filters}>
        <div />
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add rule</Button>
        </div>
      </div>

      <Card title="Pricing Rules">
        {pricing.length === 0 ? (
          <p className={formStyles.hint}>No pricing rules yet. Add a platform default or audience-specific override.</p>
        ) : (
          <Table
            columns={[
              {
                key: 'service',
                header: 'Service',
                render: (p) => (p.services as { name: string } | null)?.name ?? '—',
              },
              {
                key: 'scope',
                header: 'Scope',
                render: (p) =>
                  scopeLabel(
                    (p.scope as string | null) ?? (p.community_id ? 'community' : 'all'),
                  ),
              },
              {
                key: 'target',
                header: 'Target',
                render: (p) => targetLabel(p),
              },
              {
                key: 'price',
                header: 'Base Price',
                render: (p) => formatCurrency(Number(p.base_price)),
              },
              {
                key: 'express',
                header: 'Express ×',
                render: (p) => String(p.express_multiplier ?? 1.5),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (p) => (
                  <div className={formStyles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEdit(p)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteId(p.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={pricing}
            keyExtractor={(p) => p.id}
          />
        )}
      </Card>

      <CreateEntityModal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit pricing rule' : 'Add pricing rule'}
        onSubmit={handleSave}
        submitLabel={editing ? 'Save' : 'Create'}
        submitting={submitting}
        size="wide"
      >
        <div className={formStyles.stack}>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="pricing-service">
              Service *
            </label>
            <select
              id="pricing-service"
              className={formStyles.select}
              value={form.serviceId}
              onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
            >
              <option value="">Select service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className={formStyles.field}>
            <span className={formStyles.label}>Applies to *</span>
            <p className={formStyles.hint}>
              Most granular matching rule wins for a customer: User → Community → City → All.
            </p>
            <div className={formStyles.checkRow}>
              {(['all', 'city', 'community', 'user'] as PricingScope[]).map((scope) => (
                <label key={scope} className={formStyles.checkLabel}>
                  <input
                    type="radio"
                    name="pricing-scope"
                    checked={form.scope === scope}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        scope,
                        city: scope === 'city' ? f.city : '',
                        communityId: scope === 'community' ? f.communityId : '',
                        userId: scope === 'user' ? f.userId : '',
                        userLabel: scope === 'user' ? f.userLabel : '',
                      }))
                    }
                  />
                  {scopeLabel(scope)}
                </label>
              ))}
            </div>
          </div>

          {form.scope === 'city' && (
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="pricing-city">
                City *
              </label>
              <select
                id="pricing-city"
                className={formStyles.select}
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              >
                <option value="">Select city</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.scope === 'community' && (
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="pricing-community">
                Community *
              </label>
              <select
                id="pricing-community"
                className={formStyles.select}
                value={form.communityId}
                onChange={(e) => setForm((f) => ({ ...f, communityId: e.target.value }))}
              >
                <option value="">Select community</option>
                {communities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.city ? ` (${c.city})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {form.scope === 'user' && (
            <div className={formStyles.field}>
              <span className={formStyles.label}>Customer *</span>
              <p className={formStyles.hint}>
                {form.userId
                  ? form.userLabel || `Selected (${form.userId.slice(0, 8)}…)`
                  : 'No customer selected'}
              </p>
              <div className={formStyles.rowActions}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPickerSelectedIds(
                      form.userId ? new Set([form.userId]) : new Set(),
                    );
                    setUserPickerOpen(true);
                  }}
                >
                  {form.userId ? 'Change customer' : 'Select customer'}
                </Button>
                {form.userId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setForm((f) => ({ ...f, userId: '', userLabel: '' }))
                    }
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="pricing-base">
              Base price (₹) *
            </label>
            <input
              id="pricing-base"
              className={formStyles.input}
              type="number"
              min={0}
              step="any"
              value={form.basePrice}
              onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
            />
          </div>

          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="pricing-express">
              Express multiplier
            </label>
            <input
              id="pricing-express"
              className={formStyles.input}
              type="number"
              min={0}
              step="any"
              value={form.expressMultiplier}
              onChange={(e) =>
                setForm((f) => ({ ...f, expressMultiplier: e.target.value }))
              }
            />
          </div>
        </div>
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete pricing rule?"
        message="This action cannot be undone."
        confirmLabel={deletePricing.isPending ? 'Deleting...' : 'Delete'}
        danger
      />

      <Modal
        open={userPickerOpen}
        onClose={() => setUserPickerOpen(false)}
        title="Select customer"
        size="xwide"
        stacked
        footer={
          <>
            <Button variant="secondary" onClick={() => setUserPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const id = Array.from(pickerSelectedIds)[0] ?? '';
                if (!id) {
                  toast('Select one customer', 'error');
                  return;
                }
                setForm((f) => ({
                  ...f,
                  userId: id,
                  userLabel: '',
                }));
                setUserPickerOpen(false);
              }}
            >
              Use selected
            </Button>
          </>
        }
      >
        <p className={formStyles.hint}>Pick a single customer. Selecting another replaces the previous choice.</p>
        <CustomersGrid
          mode="picker"
          selectedIds={pickerSelectedIds}
          onSelectedIdsChange={(next) => {
            // Single-select: keep only the newest id.
            if (next.size <= 1) {
              setPickerSelectedIds(next);
              return;
            }
            const prev = pickerSelectedIds;
            const added = Array.from(next).find((id) => !prev.has(id));
            setPickerSelectedIds(added ? new Set([added]) : next);
          }}
        />
      </Modal>
    </>
  );
};
