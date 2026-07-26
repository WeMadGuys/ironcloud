'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
  Button,
  Card,
  ConfirmationDialog,
  CreateEntityModal,
  Loader,
  Table,
} from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import { trpc } from '@/lib/trpc';

import {
  fetchBanners,
  fetchCampaigns,
  fetchCoupons,
  fetchReferrals,
} from '../services/promotions.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type CouponRow = Awaited<ReturnType<typeof fetchCoupons>>[number];
type CampaignRow = Awaited<ReturnType<typeof fetchCampaigns>>[number];
type BannerRow = Awaited<ReturnType<typeof fetchBanners>>[number];

const emptyCoupon = () => ({
  code: '',
  discountType: 'percentage' as 'flat' | 'percentage',
  discountValue: '',
  maxDiscount: '',
  usageLimit: '',
  applicableOrder: true,
  applicableWallet: false,
  minAmount: '',
  validFrom: '',
  validTo: '',
  communityIds: [] as string[],
  cities: [] as string[],
});

const emptyCampaign = () => ({
  name: '',
  type: 'promo',
  channel: 'push' as 'push' | 'sms' | 'whatsapp' | 'email' | 'in_app',
  status: 'draft',
});

const emptyBanner = () => ({
  title: '',
  position: 'home',
  link: '',
  isActive: true,
});

function toIsoOrNull(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function scopeLabel(applicableOn: string[] | null | undefined): string {
  const scopes = applicableOn ?? ['order'];
  const parts: string[] = [];
  if (scopes.includes('order')) parts.push('Order');
  if (scopes.includes('wallet_topup')) parts.push('Wallet');
  return parts.join(' + ') || '—';
}

export const PromotionsPage = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [referrals, setReferrals] = useState<Awaited<ReturnType<typeof fetchReferrals>>>([]);
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('coupons');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null);
  const [editingBanner, setEditingBanner] = useState<BannerRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [bannerForm, setBannerForm] = useState(emptyBanner);

  const createCoupon = trpc.promotions.createCoupon.useMutation();
  const updateCoupon = trpc.promotions.updateCoupon.useMutation();
  const deleteCoupon = trpc.promotions.deleteCoupon.useMutation();
  const createCampaign = trpc.promotions.createCampaign.useMutation();
  const updateCampaign = trpc.promotions.updateCampaign.useMutation();
  const deleteCampaign = trpc.promotions.deleteCampaign.useMutation();
  const createBanner = trpc.promotions.createBanner.useMutation();
  const updateBanner = trpc.promotions.updateBanner.useMutation();
  const deleteBanner = trpc.promotions.deleteBanner.useMutation();

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of communities) {
      if (c.city?.trim()) set.add(c.city.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [communities]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchCoupons(),
      fetchCampaigns(),
      fetchBanners(),
      fetchReferrals(),
      fetchCommunityOptions(),
    ]).then(([c, ca, b, r, communityOpts]) => {
      setCoupons(c);
      setCampaigns(ca);
      setBanners(b);
      setReferrals(r);
      setCommunities(communityOpts.filter((x) => x.status === 'active' || !x.status));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingCoupon(null);
    setEditingCampaign(null);
    setEditingBanner(null);
    setCouponForm(emptyCoupon());
    setCampaignForm(emptyCampaign());
    setBannerForm(emptyBanner());
  };

  const openCreate = () => {
    closeModal();
    setModalOpen(true);
  };

  const buildCouponPayload = () => {
    const discountValue = Number(couponForm.discountValue);
    const applicableOn: Array<'order' | 'wallet_topup'> = [];
    if (couponForm.applicableOrder) applicableOn.push('order');
    if (couponForm.applicableWallet) applicableOn.push('wallet_topup');

    return {
      code: couponForm.code.trim(),
      discountType: couponForm.discountType,
      discountValue,
      maxDiscount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : null,
      usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : null,
      validFrom: toIsoOrNull(couponForm.validFrom),
      validTo: toIsoOrNull(couponForm.validTo),
      applicableOn,
      communityIds: couponForm.communityIds.length ? couponForm.communityIds : null,
      cities: couponForm.cities.length ? couponForm.cities : null,
      minAmount: couponForm.minAmount ? Number(couponForm.minAmount) : null,
    };
  };

  const handleSave = () => {
    if (tab === 'coupons') {
      const discountValue = Number(couponForm.discountValue);
      if (!couponForm.code.trim() || !Number.isFinite(discountValue) || discountValue <= 0) {
        toast('Code and a positive discount value are required', 'error');
        return;
      }
      if (!couponForm.applicableOrder && !couponForm.applicableWallet) {
        toast('Select at least one applicable area (Order or Wallet top-up)', 'error');
        return;
      }

      const payload = buildCouponPayload();

      if (editingCoupon) {
        updateCoupon.mutate(
          { id: editingCoupon.id, ...payload },
          {
            onSuccess: () => {
              toast('Coupon updated', 'success');
              closeModal();
              load();
            },
            onError: (err) => toast(err.message, 'error'),
          },
        );
      } else {
        createCoupon.mutate(payload, {
          onSuccess: () => {
            toast('Coupon created', 'success');
            closeModal();
            load();
          },
          onError: (err) => toast(err.message, 'error'),
        });
      }
      return;
    }

    if (tab === 'campaigns') {
      if (!campaignForm.name.trim() || !campaignForm.type.trim()) {
        toast('Name and type are required', 'error');
        return;
      }
      if (editingCampaign) {
        updateCampaign.mutate(
          {
            id: editingCampaign.id,
            name: campaignForm.name.trim(),
            type: campaignForm.type.trim(),
            channel: campaignForm.channel,
            status: campaignForm.status,
          },
          {
            onSuccess: () => {
              toast('Campaign updated', 'success');
              closeModal();
              load();
            },
            onError: (err) => toast(err.message, 'error'),
          },
        );
      } else {
        createCampaign.mutate(
          {
            name: campaignForm.name.trim(),
            type: campaignForm.type.trim(),
            channel: campaignForm.channel,
          },
          {
            onSuccess: () => {
              toast('Campaign created', 'success');
              closeModal();
              load();
            },
            onError: (err) => toast(err.message, 'error'),
          },
        );
      }
      return;
    }

    if (tab === 'banners') {
      if (!bannerForm.title.trim()) {
        toast('Title is required', 'error');
        return;
      }
      if (editingBanner) {
        updateBanner.mutate(
          {
            id: editingBanner.id,
            title: bannerForm.title.trim(),
            position: bannerForm.position.trim() || 'home',
            link: bannerForm.link.trim() || null,
            isActive: bannerForm.isActive,
          },
          {
            onSuccess: () => {
              toast('Banner updated', 'success');
              closeModal();
              load();
            },
            onError: (err) => toast(err.message, 'error'),
          },
        );
      } else {
        createBanner.mutate(
          {
            title: bannerForm.title.trim(),
            position: bannerForm.position.trim() || 'home',
            link: bannerForm.link.trim() || undefined,
          },
          {
            onSuccess: () => {
              toast('Banner created', 'success');
              closeModal();
              load();
            },
            onError: (err) => toast(err.message, 'error'),
          },
        );
      }
    }
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const onDone = {
      onSuccess: () => {
        toast('Deleted', 'success');
        setDeleteTarget(null);
        load();
      },
      onError: (err: { message: string }) => toast(err.message, 'error'),
    };

    if (deleteTarget.type === 'coupon') deleteCoupon.mutate({ id: deleteTarget.id }, onDone);
    if (deleteTarget.type === 'campaign') deleteCampaign.mutate({ id: deleteTarget.id }, onDone);
    if (deleteTarget.type === 'banner') deleteBanner.mutate({ id: deleteTarget.id }, onDone);
  };

  const openEditCoupon = (c: CouponRow) => {
    const scopes = (c.applicable_on as string[] | null) ?? ['order'];
    setEditingCoupon(c);
    setCouponForm({
      code: c.code ?? '',
      discountType: (c.discount_type as 'flat' | 'percentage') || 'percentage',
      discountValue: String(c.discount_value ?? ''),
      maxDiscount: c.max_discount != null ? String(c.max_discount) : '',
      usageLimit: c.usage_limit != null ? String(c.usage_limit) : '',
      applicableOrder: scopes.includes('order'),
      applicableWallet: scopes.includes('wallet_topup'),
      minAmount: c.min_amount != null ? String(c.min_amount) : '',
      validFrom: toLocalInput(c.valid_from),
      validTo: toLocalInput(c.valid_to),
      communityIds: (c.community_ids as string[] | null) ?? [],
      cities: (c.cities as string[] | null) ?? [],
    });
    setModalOpen(true);
  };

  if (loading) return <Loader fullPage />;

  const tabs = ['coupons', 'campaigns', 'banners', 'referrals'] as const;
  const canAdd = tab !== 'referrals';
  const isEditing = Boolean(editingCoupon || editingCampaign || editingBanner);
  const addLabel =
    tab === 'coupons' ? 'Add Coupon' : tab === 'campaigns' ? 'Add Campaign' : 'Add Banner';
  const modalTitle = isEditing
    ? tab === 'coupons'
      ? 'Edit Coupon'
      : tab === 'campaigns'
        ? 'Edit Campaign'
        : 'Edit Banner'
    : addLabel;
  const submitting =
    createCoupon.isPending ||
    updateCoupon.isPending ||
    createCampaign.isPending ||
    updateCampaign.isPending ||
    createBanner.isPending ||
    updateBanner.isPending;
  const deleting =
    deleteCoupon.isPending || deleteCampaign.isPending || deleteBanner.isPending;

  const toggleCommunity = (id: string) => {
    setCouponForm((f) => ({
      ...f,
      communityIds: f.communityIds.includes(id)
        ? f.communityIds.filter((x) => x !== id)
        : [...f.communityIds, id],
    }));
  };

  const toggleCity = (city: string) => {
    setCouponForm((f) => ({
      ...f,
      cities: f.cities.includes(city)
        ? f.cities.filter((x) => x !== city)
        : [...f.cities, city],
    }));
  };

  return (
    <div>
      <div className={pageStyles.filters}>
        <div className={pageStyles.tabs} style={{ marginBottom: 0, borderBottom: 'none' }}>
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={`${pageStyles.tab} ${tab === t ? pageStyles.tabActive : ''}`}
              onClick={() => {
                setTab(t);
                closeModal();
              }}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {canAdd && (
          <div className={pageStyles.filtersAction}>
            <Button onClick={openCreate}>{addLabel}</Button>
          </div>
        )}
      </div>

      {tab === 'coupons' && (
        <Card title="Coupons">
          <Table
            columns={[
              { key: 'code', header: 'Code', render: (c) => c.code },
              {
                key: 'scope',
                header: 'Applies to',
                render: (c) => scopeLabel(c.applicable_on as string[] | null),
              },
              { key: 'type', header: 'Type', render: (c) => c.discount_type },
              { key: 'value', header: 'Value', render: (c) => c.discount_value },
              {
                key: 'min',
                header: 'Min amount',
                render: (c) => (c.min_amount != null ? `₹${c.min_amount}` : '—'),
              },
              {
                key: 'target',
                header: 'Target',
                render: (c) => {
                  const communitiesCount = (c.community_ids as string[] | null)?.length ?? 0;
                  const citiesCount = (c.cities as string[] | null)?.length ?? 0;
                  if (!communitiesCount && !citiesCount) return 'Everyone';
                  const bits: string[] = [];
                  if (communitiesCount) bits.push(`${communitiesCount} community`);
                  if (citiesCount) bits.push(`${citiesCount} city`);
                  return bits.join(', ');
                },
              },
              {
                key: 'used',
                header: 'Used',
                render: (c) => `${c.used_count}/${c.usage_limit ?? '∞'}`,
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (c) => (
                  <div className={formStyles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => openEditCoupon(c)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget({ type: 'coupon', id: c.id })}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={coupons}
            keyExtractor={(c) => c.id}
          />
        </Card>
      )}

      {tab === 'campaigns' && (
        <Card title="Campaigns">
          <Table
            columns={[
              { key: 'name', header: 'Name', render: (c) => c.name },
              { key: 'type', header: 'Type', render: (c) => c.type },
              { key: 'channel', header: 'Channel', render: (c) => c.channel },
              {
                key: 'status',
                header: 'Status',
                render: (c) => <Badge>{c.status}</Badge>,
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (c) => (
                  <div className={formStyles.rowActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingCampaign(c);
                        setCampaignForm({
                          name: c.name ?? '',
                          type: c.type ?? 'promo',
                          channel: (c.channel as typeof campaignForm.channel) || 'push',
                          status: c.status ?? 'draft',
                        });
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget({ type: 'campaign', id: c.id })}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={campaigns}
            keyExtractor={(c) => c.id}
          />
        </Card>
      )}

      {tab === 'banners' && (
        <Card title="Banners">
          <Table
            columns={[
              { key: 'title', header: 'Title', render: (b) => b.title },
              { key: 'position', header: 'Position', render: (b) => b.position },
              {
                key: 'active',
                header: 'Active',
                render: (b) => (
                  <Badge variant={b.is_active ? 'success' : 'default'}>
                    {b.is_active ? 'Yes' : 'No'}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (b) => (
                  <div className={formStyles.rowActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEditingBanner(b);
                        setBannerForm({
                          title: b.title ?? '',
                          position: b.position ?? 'home',
                          link: b.link ?? '',
                          isActive: Boolean(b.is_active),
                        });
                        setModalOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleteTarget({ type: 'banner', id: b.id })}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            data={banners}
            keyExtractor={(b) => b.id}
          />
        </Card>
      )}

      {tab === 'referrals' && (
        <Card title="Referrals">
          <Table
            columns={[
              { key: 'code', header: 'Code', render: (r) => r.code },
              { key: 'reward', header: 'Reward', render: (r) => r.reward_amount },
              { key: 'status', header: 'Status', render: (r) => r.status },
            ]}
            data={referrals}
            keyExtractor={(r) => r.id}
          />
        </Card>
      )}

      <CreateEntityModal
        open={modalOpen && canAdd}
        onClose={closeModal}
        title={modalTitle}
        onSubmit={handleSave}
        submitLabel={isEditing ? 'Save' : 'Create'}
        submitting={submitting}
      >
        {tab === 'coupons' && (
          <div className={formStyles.stack}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-code">
                Code *
              </label>
              <input
                id="coupon-code"
                className={formStyles.input}
                value={couponForm.code}
                onChange={(e) => setCouponForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="SAVE10"
              />
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Applicable on *</span>
              <div className={formStyles.checkRow}>
                <label className={formStyles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={couponForm.applicableOrder}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, applicableOrder: e.target.checked }))
                    }
                  />
                  Order
                </label>
                <label className={formStyles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={couponForm.applicableWallet}
                    onChange={(e) =>
                      setCouponForm((f) => ({ ...f, applicableWallet: e.target.checked }))
                    }
                  />
                  Wallet top-up
                </label>
              </div>
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-type">
                Discount type
              </label>
              <select
                id="coupon-type"
                className={formStyles.select}
                value={couponForm.discountType}
                onChange={(e) =>
                  setCouponForm((f) => ({
                    ...f,
                    discountType: e.target.value as 'flat' | 'percentage',
                  }))
                }
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat</option>
              </select>
              <p className={formStyles.hint}>
                For wallet top-up this is bonus credit on the amount added.
              </p>
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-value">
                Discount value *
              </label>
              <input
                id="coupon-value"
                className={formStyles.input}
                type="number"
                min={0}
                step="any"
                value={couponForm.discountValue}
                onChange={(e) => setCouponForm((f) => ({ ...f, discountValue: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-max">
                Max discount / bonus
              </label>
              <input
                id="coupon-max"
                className={formStyles.input}
                type="number"
                min={0}
                step="any"
                value={couponForm.maxDiscount}
                onChange={(e) => setCouponForm((f) => ({ ...f, maxDiscount: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-min">
                Min amount
              </label>
              <input
                id="coupon-min"
                className={formStyles.input}
                type="number"
                min={0}
                step="any"
                value={couponForm.minAmount}
                onChange={(e) => setCouponForm((f) => ({ ...f, minAmount: e.target.value }))}
                placeholder="e.g. 500"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-limit">
                Usage limit
              </label>
              <input
                id="coupon-limit"
                className={formStyles.input}
                type="number"
                min={1}
                value={couponForm.usageLimit}
                onChange={(e) => setCouponForm((f) => ({ ...f, usageLimit: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-from">
                Valid from
              </label>
              <input
                id="coupon-from"
                className={formStyles.input}
                type="datetime-local"
                value={couponForm.validFrom}
                onChange={(e) => setCouponForm((f) => ({ ...f, validFrom: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="coupon-to">
                Valid to
              </label>
              <input
                id="coupon-to"
                className={formStyles.input}
                type="datetime-local"
                value={couponForm.validTo}
                onChange={(e) => setCouponForm((f) => ({ ...f, validTo: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Communities (optional)</span>
              <p className={formStyles.hint}>Leave empty for all communities</p>
              <div className={formStyles.checkGrid}>
                {communities.map((c) => (
                  <label key={c.id} className={formStyles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={couponForm.communityIds.includes(c.id)}
                      onChange={() => toggleCommunity(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Cities (optional)</span>
              <p className={formStyles.hint}>Leave empty for all cities</p>
              <div className={formStyles.checkGrid}>
                {cityOptions.map((city) => (
                  <label key={city} className={formStyles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={couponForm.cities.includes(city)}
                      onChange={() => toggleCity(city)}
                    />
                    {city}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'campaigns' && (
          <div className={formStyles.stack}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="campaign-name">
                Name *
              </label>
              <input
                id="campaign-name"
                className={formStyles.input}
                value={campaignForm.name}
                onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Campaign name"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="campaign-type">
                Type *
              </label>
              <input
                id="campaign-type"
                className={formStyles.input}
                value={campaignForm.type}
                onChange={(e) => setCampaignForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="promo"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="campaign-channel">
                Channel
              </label>
              <select
                id="campaign-channel"
                className={formStyles.select}
                value={campaignForm.channel}
                onChange={(e) =>
                  setCampaignForm((f) => ({
                    ...f,
                    channel: e.target.value as typeof campaignForm.channel,
                  }))
                }
              >
                <option value="push">Push</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="in_app">In-app</option>
              </select>
            </div>
            {editingCampaign && (
              <div className={formStyles.field}>
                <label className={formStyles.label} htmlFor="campaign-status">
                  Status
                </label>
                <select
                  id="campaign-status"
                  className={formStyles.select}
                  value={campaignForm.status}
                  onChange={(e) => setCampaignForm((f) => ({ ...f, status: e.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            )}
          </div>
        )}

        {tab === 'banners' && (
          <div className={formStyles.stack}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="banner-title">
                Title *
              </label>
              <input
                id="banner-title"
                className={formStyles.input}
                value={bannerForm.title}
                onChange={(e) => setBannerForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Banner title"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="banner-position">
                Position
              </label>
              <input
                id="banner-position"
                className={formStyles.input}
                value={bannerForm.position}
                onChange={(e) => setBannerForm((f) => ({ ...f, position: e.target.value }))}
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="banner-link">
                Link
              </label>
              <input
                id="banner-link"
                className={formStyles.input}
                value={bannerForm.link}
                onChange={(e) => setBannerForm((f) => ({ ...f, link: e.target.value }))}
              />
            </div>
            {editingBanner && (
              <label className={formStyles.checkLabel}>
                <input
                  type="checkbox"
                  checked={bannerForm.isActive}
                  onChange={(e) =>
                    setBannerForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                Active
              </label>
            )}
          </div>
        )}
      </CreateEntityModal>

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete item?"
        message="This action cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
      />
    </div>
  );
};
