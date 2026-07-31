'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Badge,
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

import {
  fetchBanners,
  fetchCampaigns,
  fetchCoupons,
  fetchReferralAttributions,
  fetchReferralPrograms,
  uploadBannerImage,
} from '../services/promotions.service';

import formStyles from '@/styles/form.module.css';
import pageStyles from '@/styles/pages.module.css';

type CouponRow = Awaited<ReturnType<typeof fetchCoupons>>[number];
type CampaignRow = Awaited<ReturnType<typeof fetchCampaigns>>[number];
type BannerRow = Awaited<ReturnType<typeof fetchBanners>>[number];
type ReferralProgramRow = Awaited<ReturnType<typeof fetchReferralPrograms>>[number];
type ReferralAttributionRow = Awaited<ReturnType<typeof fetchReferralAttributions>>[number];

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
  imageUrl: '',
  maxImpressions: '1',
  isActive: true,
  communityIds: [] as string[],
  cities: [] as string[],
  userIds: [] as string[],
});

const emptyReferralProgram = () => ({
  name: 'Refer & Earn',
  isActive: true,
  referrerRewardAmount: '100',
  refereeRewardAmount: '50',
  minRefereeTopupAmount: '299',
  validFrom: '',
  validTo: '',
  communityIds: [] as string[],
  cities: [] as string[],
  maxReferralsPerReferrer: '',
  shareMessageTemplate:
    'Join IronCloud with my code {{code}} and get ₹{{referee_reward}} after your first wallet recharge of ₹{{min_topup}}+!',
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
  const [referralPrograms, setReferralPrograms] = useState<ReferralProgramRow[]>([]);
  const [referralAttributions, setReferralAttributions] = useState<ReferralAttributionRow[]>(
    [],
  );
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('coupons');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRow | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<CampaignRow | null>(null);
  const [editingBanner, setEditingBanner] = useState<BannerRow | null>(null);
  const [editingReferralProgram, setEditingReferralProgram] =
    useState<ReferralProgramRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [bannerForm, setBannerForm] = useState(emptyBanner);
  const [referralForm, setReferralForm] = useState(emptyReferralProgram);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());

  const createCoupon = trpc.promotions.createCoupon.useMutation();
  const updateCoupon = trpc.promotions.updateCoupon.useMutation();
  const deleteCoupon = trpc.promotions.deleteCoupon.useMutation();
  const createCampaign = trpc.promotions.createCampaign.useMutation();
  const updateCampaign = trpc.promotions.updateCampaign.useMutation();
  const deleteCampaign = trpc.promotions.deleteCampaign.useMutation();
  const createBanner = trpc.promotions.createBanner.useMutation();
  const updateBanner = trpc.promotions.updateBanner.useMutation();
  const deleteBanner = trpc.promotions.deleteBanner.useMutation();
  const createReferralProgram = trpc.promotions.createReferralProgram.useMutation();
  const updateReferralProgram = trpc.promotions.updateReferralProgram.useMutation();
  const deleteReferralProgram = trpc.promotions.deleteReferralProgram.useMutation();

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
      fetchReferralPrograms(),
      fetchReferralAttributions(),
      fetchCommunityOptions(),
    ]).then(([c, ca, b, programs, attributions, communityOpts]) => {
      setCoupons(c);
      setCampaigns(ca);
      setBanners(b);
      setReferralPrograms(programs);
      setReferralAttributions(attributions);
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
    setEditingReferralProgram(null);
    setCouponForm(emptyCoupon());
    setCampaignForm(emptyCampaign());
    setBannerForm(emptyBanner());
    setReferralForm(emptyReferralProgram());
    setUploadingBannerImage(false);
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
      const imageUrl = bannerForm.imageUrl.trim();
      if (!imageUrl) {
        toast('Upload a banner image (or paste an image URL)', 'error');
        return;
      }
      try {
        // Validate absolute URL for the customer Image component.
        // eslint-disable-next-line no-new
        new URL(imageUrl);
      } catch {
        toast('Image URL must be a valid absolute URL', 'error');
        return;
      }
      const maxImpressions = Number.parseInt(bannerForm.maxImpressions, 10);
      if (!Number.isFinite(maxImpressions) || maxImpressions < 1) {
        toast('Max shows must be at least 1', 'error');
        return;
      }
      if (editingBanner) {
        updateBanner.mutate(
          {
            id: editingBanner.id,
            title: bannerForm.title.trim(),
            imageUrl: imageUrl || null,
            position: bannerForm.position.trim() || 'home',
            link: bannerForm.link.trim() || null,
            maxImpressions,
            isActive: bannerForm.isActive,
            communityIds: bannerForm.communityIds.length
              ? bannerForm.communityIds
              : null,
            cities: bannerForm.cities.length ? bannerForm.cities : null,
            userIds: bannerForm.userIds.length ? bannerForm.userIds : null,
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
            imageUrl: imageUrl || null,
            position: bannerForm.position.trim() || 'home',
            link: bannerForm.link.trim() || null,
            maxImpressions,
            isActive: bannerForm.isActive,
            communityIds: bannerForm.communityIds.length
              ? bannerForm.communityIds
              : null,
            cities: bannerForm.cities.length ? bannerForm.cities : null,
            userIds: bannerForm.userIds.length ? bannerForm.userIds : null,
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
      return;
    }

    if (tab === 'referrals') {
      if (!referralForm.name.trim()) {
        toast('Program name is required', 'error');
        return;
      }
      const referrerRewardAmount = Number(referralForm.referrerRewardAmount);
      const refereeRewardAmount = Number(referralForm.refereeRewardAmount);
      const minRefereeTopupAmount = Number(referralForm.minRefereeTopupAmount);
      if (
        !Number.isFinite(referrerRewardAmount) ||
        referrerRewardAmount < 0 ||
        !Number.isFinite(refereeRewardAmount) ||
        refereeRewardAmount < 0 ||
        !Number.isFinite(minRefereeTopupAmount) ||
        minRefereeTopupAmount < 0
      ) {
        toast('Reward and minimum top-up amounts must be valid numbers', 'error');
        return;
      }

      const payload = {
        name: referralForm.name.trim(),
        isActive: referralForm.isActive,
        referrerRewardAmount,
        refereeRewardAmount,
        minRefereeTopupAmount,
        validFrom: toIsoOrNull(referralForm.validFrom),
        validTo: toIsoOrNull(referralForm.validTo),
        communityIds: referralForm.communityIds.length
          ? referralForm.communityIds
          : null,
        cities: referralForm.cities.length ? referralForm.cities : null,
        maxReferralsPerReferrer: referralForm.maxReferralsPerReferrer
          ? Number(referralForm.maxReferralsPerReferrer)
          : null,
        shareMessageTemplate: referralForm.shareMessageTemplate.trim() || null,
      };

      if (editingReferralProgram) {
        updateReferralProgram.mutate(
          { id: editingReferralProgram.id, ...payload },
          {
            onSuccess: () => {
              toast('Referral program updated', 'success');
              closeModal();
              load();
            },
            onError: (err) => toast(err.message, 'error'),
          },
        );
      } else {
        createReferralProgram.mutate(payload, {
          onSuccess: () => {
            toast('Referral program created', 'success');
            closeModal();
            load();
          },
          onError: (err) => toast(err.message, 'error'),
        });
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
    if (deleteTarget.type === 'referral_program') {
      deleteReferralProgram.mutate({ id: deleteTarget.id }, onDone);
    }
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
  const canAdd = true;
  const isEditing = Boolean(
    editingCoupon || editingCampaign || editingBanner || editingReferralProgram,
  );
  const addLabel =
    tab === 'coupons'
      ? 'Add Coupon'
      : tab === 'campaigns'
        ? 'Add Campaign'
        : tab === 'banners'
          ? 'Add Banner'
          : 'Add Program';
  const modalTitle = isEditing
    ? tab === 'coupons'
      ? 'Edit Coupon'
      : tab === 'campaigns'
        ? 'Edit Campaign'
        : tab === 'banners'
          ? 'Edit Banner'
          : 'Edit Referral Program'
    : addLabel;
  const submitting =
    createCoupon.isPending ||
    updateCoupon.isPending ||
    createCampaign.isPending ||
    updateCampaign.isPending ||
    createBanner.isPending ||
    updateBanner.isPending ||
    createReferralProgram.isPending ||
    updateReferralProgram.isPending ||
    uploadingBannerImage;
  const deleting =
    deleteCoupon.isPending ||
    deleteCampaign.isPending ||
    deleteBanner.isPending ||
    deleteReferralProgram.isPending;

  const toggleCommunity = (id: string) => {
    if (tab === 'referrals') {
      setReferralForm((f) => ({
        ...f,
        communityIds: f.communityIds.includes(id)
          ? f.communityIds.filter((x) => x !== id)
          : [...f.communityIds, id],
      }));
      return;
    }
    if (tab === 'banners') {
      setBannerForm((f) => ({
        ...f,
        communityIds: f.communityIds.includes(id)
          ? f.communityIds.filter((x) => x !== id)
          : [...f.communityIds, id],
      }));
      return;
    }
    setCouponForm((f) => ({
      ...f,
      communityIds: f.communityIds.includes(id)
        ? f.communityIds.filter((x) => x !== id)
        : [...f.communityIds, id],
    }));
  };

  const toggleCity = (city: string) => {
    if (tab === 'referrals') {
      setReferralForm((f) => ({
        ...f,
        cities: f.cities.includes(city)
          ? f.cities.filter((x) => x !== city)
          : [...f.cities, city],
      }));
      return;
    }
    if (tab === 'banners') {
      setBannerForm((f) => ({
        ...f,
        cities: f.cities.includes(city)
          ? f.cities.filter((x) => x !== city)
          : [...f.cities, city],
      }));
      return;
    }
    setCouponForm((f) => ({
      ...f,
      cities: f.cities.includes(city)
        ? f.cities.filter((x) => x !== city)
        : [...f.cities, city],
    }));
  };

  const handleBannerImageSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploadingBannerImage(true);
    try {
      const imageUrl = await uploadBannerImage(file);
      setBannerForm((f) => ({ ...f, imageUrl }));
      toast('Image uploaded', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const openEditReferralProgram = (p: ReferralProgramRow) => {
    setEditingReferralProgram(p);
    setReferralForm({
      name: p.name ?? '',
      isActive: Boolean(p.is_active),
      referrerRewardAmount: String(p.referrer_reward_amount ?? ''),
      refereeRewardAmount: String(p.referee_reward_amount ?? ''),
      minRefereeTopupAmount: String(p.min_referee_topup_amount ?? ''),
      validFrom: toLocalInput(p.valid_from),
      validTo: toLocalInput(p.valid_to),
      communityIds: (p.community_ids as string[] | null) ?? [],
      cities: (p.cities as string[] | null) ?? [],
      maxReferralsPerReferrer:
        p.max_referrals_per_referrer != null
          ? String(p.max_referrals_per_referrer)
          : '',
      shareMessageTemplate: p.share_message_template ?? '',
    });
    setModalOpen(true);
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
              {
                key: 'image',
                header: 'Image',
                render: (b) =>
                  b.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.image_url}
                      alt=""
                      style={{
                        width: 56,
                        height: 36,
                        objectFit: 'cover',
                        borderRadius: 4,
                      }}
                    />
                  ) : (
                    '—'
                  ),
              },
              { key: 'position', header: 'Position', render: (b) => b.position },
              {
                key: 'audience',
                header: 'Audience',
                render: (b) => {
                  const users = (b.user_ids as string[] | null)?.length ?? 0;
                  const communitiesCount =
                    (b.community_ids as string[] | null)?.length ?? 0;
                  const citiesCount = (b.cities as string[] | null)?.length ?? 0;
                  if (!users && !communitiesCount && !citiesCount) {
                    return 'Everyone';
                  }
                  const bits: string[] = [];
                  if (users) bits.push(`${users} user${users === 1 ? '' : 's'}`);
                  if (communitiesCount) {
                    bits.push(
                      `${communitiesCount} community${communitiesCount === 1 ? '' : 'ies'}`,
                    );
                  }
                  if (citiesCount) {
                    bits.push(`${citiesCount} cit${citiesCount === 1 ? 'y' : 'ies'}`);
                  }
                  return bits.join(' · ');
                },
              },
              {
                key: 'max',
                header: 'Max shows',
                render: (b) => b.max_impressions ?? 1,
              },
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
                          imageUrl: b.image_url ?? '',
                          maxImpressions: String(b.max_impressions ?? 1),
                          isActive: Boolean(b.is_active),
                          communityIds: (b.community_ids as string[] | null) ?? [],
                          cities: (b.cities as string[] | null) ?? [],
                          userIds: (b.user_ids as string[] | null) ?? [],
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
        <>
          <Card title="Referral programs">
            <Table
              columns={[
                { key: 'name', header: 'Name', render: (r) => r.name },
                {
                  key: 'referrer',
                  header: 'Referrer reward',
                  render: (r) => `₹${r.referrer_reward_amount}`,
                },
                {
                  key: 'referee',
                  header: 'Friend reward',
                  render: (r) => `₹${r.referee_reward_amount}`,
                },
                {
                  key: 'min',
                  header: 'Min top-up',
                  render: (r) => `₹${r.min_referee_topup_amount}`,
                },
                {
                  key: 'active',
                  header: 'Status',
                  render: (r) => (
                    <Badge variant={r.is_active ? 'success' : 'default'}>
                      {r.is_active ? 'Active' : 'Off'}
                    </Badge>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (r) => (
                    <div className={formStyles.rowActions}>
                      <Button variant="secondary" size="sm" onClick={() => openEditReferralProgram(r)}>
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({ type: 'referral_program', id: r.id })
                        }
                      >
                        Delete
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={referralPrograms}
              keyExtractor={(r) => r.id}
            />
          </Card>

          <Card title="Attributions">
            <Table
              columns={[
                {
                  key: 'code',
                  header: 'Code',
                  render: (r) => r.referral_code,
                },
                {
                  key: 'referrer',
                  header: 'Referrer',
                  render: (r) =>
                    (r.referrer as { full_name?: string | null } | null)?.full_name ||
                    '—',
                },
                {
                  key: 'referee',
                  header: 'Friend',
                  render: (r) =>
                    (r.referee as { full_name?: string | null } | null)?.full_name ||
                    '—',
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (r) => r.status,
                },
                {
                  key: 'reward',
                  header: 'Referrer ₹',
                  render: (r) =>
                    r.status === 'rewarded'
                      ? `₹${(r.program as { referrer_reward_amount?: number } | null)?.referrer_reward_amount ?? 0}`
                      : '—',
                },
                {
                  key: 'date',
                  header: 'Created',
                  render: (r) =>
                    r.created_at
                      ? new Date(r.created_at).toLocaleDateString()
                      : '—',
                },
              ]}
              data={referralAttributions}
              keyExtractor={(r) => r.id}
            />
          </Card>
        </>
      )}

      <CreateEntityModal
        open={modalOpen && canAdd}
        onClose={closeModal}
        title={modalTitle}
        onSubmit={handleSave}
        submitLabel={isEditing ? 'Save' : 'Create'}
        submitting={submitting}
        size={tab === 'banners' || tab === 'coupons' || tab === 'referrals' ? 'wide' : 'default'}
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
              <label className={formStyles.label} htmlFor="banner-image-file">
                Banner image *
              </label>
              {bannerForm.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerForm.imageUrl}
                  alt="Banner preview"
                  style={{
                    width: '100%',
                    maxHeight: 120,
                    objectFit: 'contain',
                    borderRadius: 8,
                    background: 'var(--ic-surface-section)',
                    border: '1px solid var(--ic-border-default)',
                  }}
                />
              ) : null}
              <input
                id="banner-image-file"
                className={formStyles.fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingBannerImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  void handleBannerImageSelect(file);
                }}
              />
              <p className={formStyles.hint}>
                {uploadingBannerImage
                  ? 'Uploading…'
                  : 'JPEG, PNG, or WebP · max 5 MB'}
              </p>
              <label className={formStyles.label} htmlFor="banner-image">
                Or paste image URL
              </label>
              <input
                id="banner-image"
                className={formStyles.input}
                value={bannerForm.imageUrl}
                onChange={(e) => setBannerForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://…"
              />
            </div>
            <div className={formStyles.row2}>
              <div className={formStyles.field}>
                <label className={formStyles.label} htmlFor="banner-max">
                  Max shows per device *
                </label>
                <input
                  id="banner-max"
                  className={formStyles.input}
                  type="number"
                  min={1}
                  step={1}
                  value={bannerForm.maxImpressions}
                  onChange={(e) =>
                    setBannerForm((f) => ({ ...f, maxImpressions: e.target.value }))
                  }
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
                  placeholder="home"
                />
              </div>
            </div>
            <p className={formStyles.hint}>
              After a customer closes the banner this many times, it will not appear again on
              that device.
            </p>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="banner-link">
                Link (optional)
              </label>
              <input
                id="banner-link"
                className={formStyles.input}
                value={bannerForm.link}
                onChange={(e) => setBannerForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://…"
              />
            </div>
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
            <div className={formStyles.field}>
              <span className={formStyles.label}>Audience</span>
              <p className={formStyles.hint}>
                Leave all empty to show to everyone. If specific users are selected, only
                those users see the banner. Otherwise community and city filters both apply
                when set.
              </p>
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Communities (optional)</span>
              <div className={formStyles.checkGrid}>
                {communities.map((c) => (
                  <label key={c.id} className={formStyles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={bannerForm.communityIds.includes(c.id)}
                      onChange={() => toggleCommunity(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Cities (optional)</span>
              <div className={formStyles.checkGrid}>
                {cityOptions.map((city) => (
                  <label key={city} className={formStyles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={bannerForm.cities.includes(city)}
                      onChange={() => toggleCity(city)}
                    />
                    {city}
                  </label>
                ))}
              </div>
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Specific customers (optional)</span>
              <p className={formStyles.hint}>
                {bannerForm.userIds.length
                  ? `${bannerForm.userIds.length} customer${bannerForm.userIds.length === 1 ? '' : 's'} selected`
                  : 'No customers selected'}
              </p>
              <div className={formStyles.rowActions}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setPickerSelectedIds(new Set(bannerForm.userIds));
                    setUserPickerOpen(true);
                  }}
                >
                  Select customers
                </Button>
                {bannerForm.userIds.length > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setBannerForm((f) => ({ ...f, userIds: [] }))}
                  >
                    Clear users
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {tab === 'referrals' && (
          <div className={formStyles.stack}>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-name">
                Program name *
              </label>
              <input
                id="ref-name"
                className={formStyles.input}
                value={referralForm.name}
                onChange={(e) => setReferralForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <label className={formStyles.checkLabel}>
              <input
                type="checkbox"
                checked={referralForm.isActive}
                onChange={(e) =>
                  setReferralForm((f) => ({ ...f, isActive: e.target.checked }))
                }
              />
              Active
            </label>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-referrer">
                Referrer reward (₹) *
              </label>
              <input
                id="ref-referrer"
                className={formStyles.input}
                type="number"
                min={0}
                step="any"
                value={referralForm.referrerRewardAmount}
                onChange={(e) =>
                  setReferralForm((f) => ({
                    ...f,
                    referrerRewardAmount: e.target.value,
                  }))
                }
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-referee">
                Friend reward (₹) *
              </label>
              <input
                id="ref-referee"
                className={formStyles.input}
                type="number"
                min={0}
                step="any"
                value={referralForm.refereeRewardAmount}
                onChange={(e) =>
                  setReferralForm((f) => ({
                    ...f,
                    refereeRewardAmount: e.target.value,
                  }))
                }
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-min">
                Min first top-up (₹) *
              </label>
              <input
                id="ref-min"
                className={formStyles.input}
                type="number"
                min={0}
                step="any"
                value={referralForm.minRefereeTopupAmount}
                onChange={(e) =>
                  setReferralForm((f) => ({
                    ...f,
                    minRefereeTopupAmount: e.target.value,
                  }))
                }
              />
              <p className={formStyles.hint}>
                Friend must recharge at least this amount once to unlock rewards.
              </p>
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-max">
                Max referrals per referrer
              </label>
              <input
                id="ref-max"
                className={formStyles.input}
                type="number"
                min={1}
                step={1}
                value={referralForm.maxReferralsPerReferrer}
                onChange={(e) =>
                  setReferralForm((f) => ({
                    ...f,
                    maxReferralsPerReferrer: e.target.value,
                  }))
                }
                placeholder="Unlimited"
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-from">
                Valid from
              </label>
              <input
                id="ref-from"
                className={formStyles.input}
                type="datetime-local"
                value={referralForm.validFrom}
                onChange={(e) =>
                  setReferralForm((f) => ({ ...f, validFrom: e.target.value }))
                }
              />
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-to">
                Valid to
              </label>
              <input
                id="ref-to"
                className={formStyles.input}
                type="datetime-local"
                value={referralForm.validTo}
                onChange={(e) =>
                  setReferralForm((f) => ({ ...f, validTo: e.target.value }))
                }
              />
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Communities (optional)</span>
              <div className={formStyles.checkRow}>
                {communities.map((c) => (
                  <label key={c.id} className={formStyles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={referralForm.communityIds.includes(c.id)}
                      onChange={() => toggleCommunity(c.id)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div className={formStyles.field}>
              <span className={formStyles.label}>Cities (optional)</span>
              <div className={formStyles.checkRow}>
                {cityOptions.map((city) => (
                  <label key={city} className={formStyles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={referralForm.cities.includes(city)}
                      onChange={() => toggleCity(city)}
                    />
                    {city}
                  </label>
                ))}
              </div>
            </div>
            <div className={formStyles.field}>
              <label className={formStyles.label} htmlFor="ref-share">
                Share message template
              </label>
              <textarea
                id="ref-share"
                className={formStyles.input}
                rows={3}
                value={referralForm.shareMessageTemplate}
                onChange={(e) =>
                  setReferralForm((f) => ({
                    ...f,
                    shareMessageTemplate: e.target.value,
                  }))
                }
              />
              <p className={formStyles.hint}>
                Placeholders: {'{{code}}'}, {'{{referee_reward}}'}, {'{{referrer_reward}}'},{' '}
                {'{{min_topup}}'}
              </p>
            </div>
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

      <Modal
        open={userPickerOpen}
        onClose={() => setUserPickerOpen(false)}
        title="Select customers"
        size="xwide"
        stacked
        footer={
          <>
            <Button variant="secondary" onClick={() => setUserPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setBannerForm((f) => ({
                  ...f,
                  userIds: Array.from(pickerSelectedIds),
                }));
                setUserPickerOpen(false);
              }}
            >
              Apply ({pickerSelectedIds.size})
            </Button>
          </>
        }
      >
        <CustomersGrid
          mode="picker"
          selectedIds={pickerSelectedIds}
          onSelectedIdsChange={setPickerSelectedIds}
        />
      </Modal>
    </div>
  );
};
