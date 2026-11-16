'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  Card,
  ConfirmationDialog,
  CreateEntityModal,
  Loader,
  Modal,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { CustomersGrid } from '@/features/customers/components/CustomersGrid';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import { trpc } from '@/lib/trpc';
import {
  listGarmentCategoryTabs,
  normalizeGarmentCategory,
  type PricingScope,
} from '@ironcloud/db';

import {
  fetchActiveServices,
  fetchGarmentCategories,
  fetchPricingRules,
} from '../services/settings.service';
import { CategoryTabBar } from './CategoryTabBar';
import { PricingRulesTable, type PricingRuleRow } from './PricingRulesTable';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type PricingRow = Awaited<ReturnType<typeof fetchPricingRules>>[number];
type ServiceOption = Awaited<ReturnType<typeof fetchActiveServices>>[number];

const NEW_SERVICE_VALUE = '__new__';
const ADD_CATEGORY_VALUE = '__new_category__';

type ServiceJoin = {
  name: string;
  garment_category?: string | null;
  sort_order?: number | null;
} | null;

function mergeServiceOrder(currentIds: string[], orderedIds: string[]): string[] {
  const wanted = new Set(orderedIds);
  const positions: number[] = [];
  currentIds.forEach((id, index) => {
    if (wanted.has(id)) positions.push(index);
  });
  const next = [...currentIds];
  orderedIds.forEach((id, index) => {
    const slot = positions[index];
    if (slot !== undefined) next[slot] = id;
  });
  return next;
}

function comparePricingRows(a: PricingRow, b: PricingRow): number {
  const orderA = Number(serviceJoin(a)?.sort_order ?? 0);
  const orderB = Number(serviceJoin(b)?.sort_order ?? 0);
  if (orderA !== orderB) return orderA - orderB;
  const nameA = serviceJoin(a)?.name ?? '';
  const nameB = serviceJoin(b)?.name ?? '';
  const byName = nameA.localeCompare(nameB);
  if (byName !== 0) return byName;
  const byService = a.service_id.localeCompare(b.service_id);
  if (byService !== 0) return byService;
  return a.id.localeCompare(b.id);
}

type PricingForm = {
  serviceId: string;
  newServiceName: string;
  serviceName: string;
  garmentCategory: string;
  newGarmentCategory: string;
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
  newServiceName: '',
  serviceName: '',
  garmentCategory: 'Men',
  newGarmentCategory: '',
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

function serviceJoin(row: PricingRow): ServiceJoin {
  return (row.services as ServiceJoin) ?? null;
}

function resolvedCategory(form: PricingForm): string {
  if (form.garmentCategory === ADD_CATEGORY_VALUE) {
    return form.newGarmentCategory.trim();
  }
  return form.garmentCategory.trim();
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
  const { toast } = useToast();
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
  const [categoryTab, setCategoryTab] = useState('All');
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  const createPricing = trpc.settings.createPricing.useMutation();
  const updatePricing = trpc.settings.updatePricing.useMutation();
  const deletePricing = trpc.settings.deletePricing.useMutation();
  const reorderServices = trpc.settings.reorderServices.useMutation();
  const reorderGarmentCategories = trpc.settings.reorderGarmentCategories.useMutation();

  const load = async () => {
    const [rules, svc, communityOpts, categories] = await Promise.all([
      fetchPricingRules(),
      fetchActiveServices(),
      fetchCommunityOptions(),
      fetchGarmentCategories(),
    ]);
    setPricing(rules);
    setServices(svc);
    setCommunities(communityOpts);
    setCategoryOrder(categories);
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

  const uniqueServices = useMemo(() => {
    const byName = new Map<string, ServiceOption>();
    for (const s of services) {
      const key = s.name.trim().toLowerCase();
      if (!key || byName.has(key)) continue;
      byName.set(key, s);
    }
    const list = Array.from(byName.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (
      form.serviceId &&
      form.serviceId !== NEW_SERVICE_VALUE &&
      !list.some((s) => s.id === form.serviceId)
    ) {
      const current = services.find((s) => s.id === form.serviceId);
      if (current) list.unshift(current);
    }
    return list;
  }, [services, form.serviceId]);

  const categoryTabs = useMemo(() => {
    const used = [
      ...services.map((service) => service.garment_category),
      ...pricing.map((row) => serviceJoin(row)?.garment_category),
    ];
    return listGarmentCategoryTabs(used, true, categoryOrder);
  }, [pricing, services, categoryOrder]);

  const categoryChoices = useMemo(() => {
    const used = categoryTabs.filter((tab) => tab !== 'All');
    if (
      form.garmentCategory &&
      form.garmentCategory !== ADD_CATEGORY_VALUE &&
      !used.includes(form.garmentCategory)
    ) {
      return listGarmentCategoryTabs(
        [...used, form.garmentCategory],
        true,
        categoryOrder,
      ).filter((tab) => tab !== 'All');
    }
    return used;
  }, [categoryTabs, categoryOrder, form.garmentCategory]);

  useEffect(() => {
    if (!categoryTabs.includes(categoryTab)) setCategoryTab('All');
  }, [categoryTab, categoryTabs]);

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
    const joined = serviceJoin(row);
    const fromList = services.find((service) => service.id === row.service_id);
    setEditing(row);
    setForm({
      serviceId: row.service_id,
      newServiceName: '',
      serviceName: joined?.name ?? fromList?.name ?? '',
      garmentCategory: normalizeGarmentCategory(
        joined?.garment_category ?? fromList?.garment_category,
      ),
      newGarmentCategory: '',
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
    const isNewService = form.serviceId === NEW_SERVICE_VALUE;
    if (!form.serviceId) {
      toast('Select a service', 'error');
      return;
    }
    if (isNewService && !form.newServiceName.trim()) {
      toast('Enter a service name', 'error');
      return;
    }
    if (!isNewService && !form.serviceName.trim()) {
      toast('Enter a service name', 'error');
      return;
    }
    const garmentCategory = resolvedCategory(form);
    if (!garmentCategory) {
      toast(
        form.garmentCategory === ADD_CATEGORY_VALUE
          ? 'Enter a category name'
          : 'Select a category',
        'error',
      );
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
      ...(isNewService
        ? { newServiceName: form.newServiceName.trim(), serviceId: null, serviceName: null }
        : {
            serviceId: form.serviceId,
            newServiceName: null,
            serviceName: form.serviceName.trim(),
          }),
      garmentCategory,
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

  const handleReorder = (orderedIds: string[]) => {
    const currentIds = [...services]
      .sort(
        (a, b) =>
          Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
          a.name.localeCompare(b.name),
      )
      .map((service) => service.id);
    const nextIds = mergeServiceOrder(currentIds, orderedIds);
    const rank = new Map(nextIds.map((id, index) => [id, index]));
    const previousServices = services;
    const previousPricing = pricing;

    setServices((prev) =>
      prev.map((service) => ({
        ...service,
        sort_order: rank.get(service.id) ?? service.sort_order ?? 0,
      })),
    );
    setPricing((prev) =>
      prev.map((row) => {
        const order = rank.get(row.service_id);
        const joined = serviceJoin(row);
        if (order == null || !joined) return row;
        return { ...row, services: { ...joined, sort_order: order } };
      }),
    );

    reorderServices.mutate(
      { orderedIds },
      {
        onError: (err) => {
          setServices(previousServices);
          setPricing(previousPricing);
          toast(err.message, 'error');
        },
      },
    );
  };

  const handleReorderCategories = (orderedNames: string[]) => {
    const visible = new Set(categoryTabs.filter((tab) => tab !== 'All'));
    const base = categoryOrder.length > 0 ? categoryOrder : Array.from(visible);
    const rest = base.filter((name) => !orderedNames.includes(name) && !visible.has(name));
    const next = [...orderedNames, ...rest];
    const previous = categoryOrder;
    setCategoryOrder(next);
    reorderGarmentCategories.mutate(
      { orderedNames: next },
      {
        onError: (err) => {
          setCategoryOrder(previous);
          toast(err.message, 'error');
        },
      },
    );
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
  const visiblePricing = (
    categoryTab === 'All'
      ? pricing
      : pricing.filter(
          (row) =>
            normalizeGarmentCategory(serviceJoin(row)?.garment_category) === categoryTab,
        )
  ).slice().sort(comparePricingRows);
  const showServiceDetails = Boolean(form.serviceId);
  const editingExistingService =
    showServiceDetails && form.serviceId !== NEW_SERVICE_VALUE;

  return (
    <>
      <div className={pageStyles.filters}>
        <div />
        <div className={pageStyles.filtersAction}>
          <Button onClick={openCreate}>Add rule</Button>
        </div>
      </div>

      <div className={`${pageStyles.tabs} ${pageStyles.tabsScroll}`}>
        <button
          type="button"
          className={`${pageStyles.tab} ${categoryTab === 'All' ? pageStyles.tabActive : ''}`}
          onClick={() => setCategoryTab('All')}
        >
          All
        </button>
        <CategoryTabBar
          tabs={categoryTabs.filter((tab) => tab !== 'All')}
          active={categoryTab}
          onSelect={setCategoryTab}
          onReorder={handleReorderCategories}
        />
      </div>

      <Card title="Pricing Rules">
        {pricing.length === 0 ? (
          <p className={formStyles.hint}>No pricing rules yet. Add a platform default or audience-specific override.</p>
        ) : visiblePricing.length === 0 ? (
          <p className={formStyles.hint}>No pricing rules in {categoryTab}.</p>
        ) : (
          <PricingRulesTable
            rows={visiblePricing as PricingRuleRow[]}
            scopeLabel={scopeLabel}
            targetLabel={(row) => targetLabel(row as PricingRow)}
            onEdit={(row) => openEdit(row as PricingRow)}
            onDelete={setDeleteId}
            onReorder={handleReorder}
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
              onChange={(e) => {
                const serviceId = e.target.value;
                const selected = uniqueServices.find((service) => service.id === serviceId);
                setForm((f) => ({
                  ...f,
                  serviceId,
                  newServiceName: serviceId === NEW_SERVICE_VALUE ? f.newServiceName : '',
                  serviceName: selected?.name ?? '',
                  garmentCategory: selected
                    ? normalizeGarmentCategory(selected.garment_category)
                    : 'Men',
                  newGarmentCategory: '',
                }));
              }}
            >
              <option value="">Select service</option>
              {uniqueServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={NEW_SERVICE_VALUE}>New service</option>
            </select>
          </div>

          {form.serviceId === NEW_SERVICE_VALUE && (
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="pricing-new-service">
                New service name *
              </label>
              <input
                id="pricing-new-service"
                className={formStyles.input}
                type="text"
                value={form.newServiceName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, newServiceName: e.target.value }))
                }
                placeholder="e.g. Blazer"
                autoFocus
              />
            </div>
          )}

          {editingExistingService && (
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="pricing-service-name">
                Service name *
              </label>
              <input
                id="pricing-service-name"
                className={formStyles.input}
                type="text"
                value={form.serviceName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, serviceName: e.target.value }))
                }
              />
              <p className={formStyles.hint}>
                Name and category apply to this service everywhere, including other price rules and the customer app.
              </p>
            </div>
          )}

          {showServiceDetails && (
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="pricing-category">
                Category *
              </label>
              <select
                id="pricing-category"
                className={formStyles.select}
                value={form.garmentCategory}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    garmentCategory: e.target.value,
                    newGarmentCategory:
                      e.target.value === ADD_CATEGORY_VALUE ? f.newGarmentCategory : '',
                  }))
                }
              >
                {categoryChoices.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                <option value={ADD_CATEGORY_VALUE}>Add category</option>
              </select>
              {form.garmentCategory === ADD_CATEGORY_VALUE && (
                <input
                  id="pricing-new-category"
                  className={formStyles.input}
                  type="text"
                  value={form.newGarmentCategory}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, newGarmentCategory: e.target.value }))
                  }
                  placeholder="e.g. House"
                  aria-label="New category name"
                  autoFocus
                />
              )}
            </div>
          )}

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
