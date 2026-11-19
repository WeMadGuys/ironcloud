import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { PromoBannerModal } from '../../src/features/banners/components/PromoBannerModal';
import {
  recordBannerImpression,
  shouldShowBanner,
} from '../../src/features/banners/services/banner-impressions.service';
import {
  pickEligibleHomeBanner,
  type PromoBanner,
} from '../../src/features/banners/services/banners.service';
import { forceLocalSignOut } from '../../src/features/auth/services/auth';
import {
  cancelBooking,
  createBooking,
  formatHourlySlotLabel,
  getDeliveryWindowFromPickup,
  getHomeBookingSnapshot,
  dismissOrderFeedback,
  markOrderReadyForRebook,
  submitOrderFeedback,
  type ActiveBooking,
} from '../../src/features/booking/services/booking.service';
import {
  dayOffsetToLocalDateKey,
  getClosedDatesForCommunity,
  getCommunityPickupSlots,
  getFullPickupWindows,
  type CommunityPickupSlot,
} from '../../src/features/booking/services/communitySlots.service';
import { ActiveOrderCard } from '../../src/features/booking/components/ActiveOrderCard';
import { DeliveredFeedbackBanner } from '../../src/features/booking/components/DeliveredFeedbackBanner';
import {
  EstimateOrderCard,
  buildEstimateLines,
  estimateTotals,
  type EstimateCounts,
} from '../../src/features/booking/components/EstimateOrderCard';
import { GarmentRateCard } from '../../src/features/booking/components/GarmentRateCard';
import { OutForDeliveryBanner } from '../../src/features/booking/components/OutForDeliveryBanner';
import type { GarmentCatalogItem } from '../../src/features/booking/services/catalog.service';
import { listAddresses } from '../../src/features/profile/services/address.service';
import { fetchUserProfile, getCachedProfile, isAnonymizedDeletedProfile } from '../../src/features/profile/services/profile.service';
import { getWallet } from '../../src/features/wallet/services/wallet.service';
import { supabase } from '../../src/lib/supabase';

interface DayOption {
  day: string;
  date: number;
  isToday: boolean;
}

const VISIBLE_SLOT_COUNT = 3;

function getNextDays(count: number): DayOption[] {
  const days: DayOption[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    days.push({
      day: dayNames[date.getDay()],
      date: date.getDate(),
      isToday: i === 0,
    });
  }
  return days;
}

function buildPickupWindow(dayOffset: number, startHour: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(start);
  end.setHours(startHour + 1, 0, 0, 0);
  return { start, end };
}

/** Hide slots whose window has already ended (mainly for today). */
function isPickupSlotAvailable(
  dayOffset: number,
  startHour: number,
  now: Date = new Date(),
): boolean {
  const { end } = buildPickupWindow(dayOffset, startHour);
  return end.getTime() > now.getTime();
}

function findNextOpenSlot(
  fromOffset: number,
  slots: CommunityPickupSlot[],
  bookedDays: number[],
  now: Date,
  dayCount: number,
  closedDates: Set<string>,
  fullKeys: Set<string>,
): { offset: number; startHour: number } | null {
  for (let offset = fromOffset; offset < dayCount; offset++) {
    if (bookedDays.includes(offset)) continue;
    if (closedDates.has(dayOffsetToLocalDateKey(offset, now))) continue;
    let earliest: CommunityPickupSlot | null = null;
    for (const slot of slots) {
      if (!isPickupSlotAvailable(offset, slot.startHour, now)) continue;
      if (fullKeys.has(`${offset}:${slot.startHour}`)) continue;
      if (!earliest || slot.startHour < earliest.startHour) earliest = slot;
    }
    if (earliest) return { offset, startHour: earliest.startHour };
  }
  return null;
}

function formatNextOpenLabel(offset: number, startHour: number): string {
  const chip = getSlotChipParts(startHour);
  const time = chip.samePeriod
    ? `${chip.range} ${chip.period}`
    : `${chip.startLabel} – ${chip.endLabel}`;
  if (offset === 0) return `Today · ${time}`;
  if (offset === 1) return `Tomorrow · ${time}`;
  const day = getNextDays(7)[offset];
  const dayLabel = day ? `${day.day} ${day.date.toString().padStart(2, '0')}` : 'Next day';
  return `${dayLabel} · ${time}`;
}

function formatDeliveryPreview(dayOffset: number, startHour: number) {
  const pickup = buildPickupWindow(dayOffset, startHour);
  const delivery = getDeliveryWindowFromPickup(pickup.start, pickup.end);

  const dateLabel = delivery.start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const timeLabel = `${delivery.start.toLocaleTimeString('en-US', timeOpts)} - ${delivery.end.toLocaleTimeString('en-US', timeOpts)}`;

  return `${dateLabel} • ${timeLabel}`;
}

/** Compact chip parts: "9:00 – 10:00" + "AM" when same period. */
function getSlotChipParts(startHour: number) {
  const clock = (hour: number) => {
    const period = hour % 24 >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return { time: `${h12}:00`, period, label: `${h12}:00 ${period}` };
  };

  const start = clock(startHour);
  const end = clock(startHour + 1);
  const samePeriod = start.period === end.period;

  return {
    samePeriod,
    range: `${start.time} – ${end.time}`,
    period: start.period,
    startLabel: start.label,
    endLabel: end.label,
  };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function HomeScreen() {
  const router = useRouter();
  const days = getNextDays(7);

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedStartHour, setSelectedStartHour] = useState<number | null>(null);
  const [pickupSlots, setPickupSlots] = useState<CommunityPickupSlot[]>([]);
  const [closedDates, setClosedDates] = useState<Set<string>>(() => new Set());
  const [fullSlotKeys, setFullSlotKeys] = useState<Set<string>>(() => new Set());
  const queuedHourRef = useRef<number | null>(null);
  /** Slot this session just booked, so cancel can clear "Full" before the refetch. */
  const bookedSlotKeyRef = useRef<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<{
    dayOffset: number;
    startHour: number;
  } | null>(null);
  const [estimateCounts, setEstimateCounts] = useState<EstimateCounts>({});
  const [estimateCatalog, setEstimateCatalog] = useState<GarmentCatalogItem[]>([]);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communityCity, setCommunityCity] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [dayBooking, setDayBooking] = useState<ActiveBooking | null>(null);
  const [ofdBooking, setOfdBooking] = useState<ActiveBooking | null>(null);
  const [feedbackBooking, setFeedbackBooking] = useState<ActiveBooking | null>(null);
  const [bookedDays, setBookedDays] = useState<number[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [headerAddress, setHeaderAddress] = useState({
    name: '',
    detail: '',
  });
  const [headerProfile, setHeaderProfile] = useState(() => {
    const cached = getCachedProfile();
    return {
      avatarUrl: cached?.avatarUrl ?? null,
      fullName: cached?.fullName ?? '',
    };
  });
  const [promoBanner, setPromoBanner] = useState<PromoBanner | null>(null);
  const bannerCheckedRef = useRef(false);
  const bannerDismissedRef = useRef(false);
  const bannerRequestRef = useRef(0);
  const audienceRef = useRef<{ communityId: string | null; city: string | null }>({
    communityId: null,
    city: null,
  });
  /** Recompute past-slot filtering / refetch closed dates when focused or a day is tapped. */
  const [slotClock, setSlotClock] = useState(() => Date.now());
  const slotsCommunityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!communityId) {
      setPickupSlots([]);
      setClosedDates(new Set());
      setSelectedStartHour(null);
      slotsCommunityRef.current = null;
      return;
    }
    let cancelled = false;
    const isNewCommunity = slotsCommunityRef.current !== communityId;
    if (isNewCommunity) setSlotsLoading(true);
    Promise.all([
      getCommunityPickupSlots(communityId),
      getClosedDatesForCommunity(communityId),
    ])
      .then(([slots, closed]) => {
        if (cancelled) return;
        setPickupSlots(slots);
        setClosedDates(closed);
        slotsCommunityRef.current = communityId;
      })
      .catch((error) => {
        console.error('Error loading pickup slots:', error);
        if (!cancelled && isNewCommunity) {
          setPickupSlots([]);
          setClosedDates(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // slotClock: date tap, focus, pull-refresh, and resume refetch closed dates.
  }, [communityId, slotClock]);

  useEffect(() => {
    if (!communityId || pickupSlots.length === 0) {
      setFullSlotKeys(new Set());
      return;
    }
    let cancelled = false;
    const windows: { key: string; windowStart: string }[] = [];
    for (let offset = 0; offset < days.length; offset++) {
      for (const slot of pickupSlots) {
        windows.push({
          key: `${offset}:${slot.startHour}`,
          windowStart: buildPickupWindow(offset, slot.startHour).start.toISOString(),
        });
      }
    }
    getFullPickupWindows(communityId, windows)
      .then((full) => {
        if (!cancelled) setFullSlotKeys(full);
      })
      .catch((error) => {
        console.error('Error loading pickup capacity:', error);
        if (!cancelled) setFullSlotKeys(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [communityId, pickupSlots, slotClock, days.length]);

  const selectedDayClosed = useMemo(() => {
    const now = new Date(slotClock);
    return closedDates.has(dayOffsetToLocalDateKey(selectedDay, now));
  }, [closedDates, selectedDay, slotClock]);

  const daySlots = useMemo(() => {
    if (selectedDayClosed) return [];
    const now = new Date(slotClock);
    return pickupSlots
      .filter((slot) => isPickupSlotAvailable(selectedDay, slot.startHour, now))
      .map((slot) => ({
        ...slot,
        full: fullSlotKeys.has(`${selectedDay}:${slot.startHour}`),
      }));
  }, [pickupSlots, selectedDay, slotClock, selectedDayClosed, fullSlotKeys]);

  const availableSlots = useMemo(
    () => daySlots.filter((slot) => !slot.full),
    [daySlots],
  );

  const nextOpenSlot = useMemo(() => {
    const now = new Date(slotClock);
    const next = findNextOpenSlot(
      selectedDay,
      pickupSlots,
      bookedDays,
      now,
      days.length,
      closedDates,
      fullSlotKeys,
    );
    if (!next) return null;
    return { ...next, label: formatNextOpenLabel(next.offset, next.startHour) };
  }, [selectedDay, pickupSlots, bookedDays, slotClock, days.length, closedDates, fullSlotKeys]);

  // Keep an explicit selection only if that slot is still bookable. Never auto-pick.
  useEffect(() => {
    setSelectedStartHour((prev) => {
      const queued = queuedHourRef.current;
      if (queued != null && availableSlots.some((slot) => slot.startHour === queued)) {
        queuedHourRef.current = null;
        return queued;
      }
      if (prev != null && availableSlots.some((slot) => slot.startHour === prev)) {
        return prev;
      }
      return null;
    });
  }, [availableSlots]);

  const deliveryPreviewLabel = useMemo(() => {
    if (selectedStartHour == null) return 'Select a pickup time';
    return formatDeliveryPreview(selectedDay, selectedStartHour);
  }, [selectedDay, selectedStartHour]);

  const visibleSlots = showAllSlots
    ? daySlots
    : daySlots.slice(0, VISIBLE_SLOT_COUNT);

  const showNextOpen = Boolean(
    nextOpenSlot &&
      daySlots.some((slot) => slot.full) &&
      (nextOpenSlot.offset !== selectedDay ||
        !visibleSlots.some(
          (slot) => !slot.full && slot.startHour === nextOpenSlot.startHour,
        )),
  );

  const hasLoadedOnceRef = useRef(false);
  const homeLoadRef = useRef(0);

  const tryShowPromoBanner = useCallback(
    async (
      ctx: { communityId: string | null; city: string | null },
      options?: { force?: boolean },
    ) => {
      if (bannerDismissedRef.current) return;
      if (bannerCheckedRef.current && !options?.force) return;

      const requestId = ++bannerRequestRef.current;
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (requestId !== bannerRequestRef.current || bannerDismissedRef.current) return;

        const candidate = await pickEligibleHomeBanner(
          {
            userId: sessionData.session?.user?.id ?? null,
            communityId: ctx.communityId,
            city: ctx.city,
          },
          { force: options?.force },
        );
        if (requestId !== bannerRequestRef.current || bannerDismissedRef.current) return;
        if (!candidate) {
          // A community banner cannot be ruled out until the address has loaded.
          if (ctx.communityId) bannerCheckedRef.current = true;
          return;
        }

        const ok = await shouldShowBanner(candidate.id, candidate.maxImpressions);
        if (requestId !== bannerRequestRef.current || bannerDismissedRef.current) return;
        if (!ok) {
          bannerCheckedRef.current = true;
          return;
        }

        bannerCheckedRef.current = true;
        setPromoBanner((current) =>
          current?.id === candidate.id ? current : candidate,
        );
      } catch (error) {
        console.error('Error loading promo banner:', error);
      }
    },
    [],
  );

  const handleCatalogLoaded = useCallback((items: GarmentCatalogItem[]) => {
    setEstimateCatalog(items);
  }, []);

  const loadHomeData = useCallback(async (dayOffset: number, mode: 'initial' | 'content' = 'content') => {
    const requestId = ++homeLoadRef.current;
    // Soft refresh: keep existing content visible after the first successful load.
    if (mode === 'initial') {
      setInitialLoading(true);
    } else if (!hasLoadedOnceRef.current) {
      setContentLoading(true);
    }
    try {
      const [snapshot, wallet, addresses, profile, sessionResult] =
        await Promise.all([
          getHomeBookingSnapshot(dayOffset),
          getWallet({ force: true }),
          listAddresses(),
          fetchUserProfile(),
          supabase.auth.getSession(),
        ]);

      if (requestId !== homeLoadRef.current) return;

      setDayBooking(snapshot.dayBooking);
      setBookedDays(snapshot.bookedDays);
      setOfdBooking(snapshot.ofdBooking);
      setFeedbackBooking(snapshot.feedbackBooking);
      if (profile && isAnonymizedDeletedProfile(profile)) {
        await forceLocalSignOut();
        router.replace('/(auth)/login');
        return;
      }
      setWalletBalance(wallet?.balance ?? null);
      setUserId(sessionResult.data.session?.user?.id ?? null);
      setHeaderProfile({
        avatarUrl: profile?.avatarUrl ?? null,
        fullName: profile?.fullName ?? '',
      });

      const defaultAddress =
        addresses.find((address) => address.isDefault) || addresses[0];
      let nextCommunityId: string | null = null;
      let nextCity: string | null = null;
      if (defaultAddress) {
        nextCommunityId = defaultAddress.communityId || null;
        nextCity = defaultAddress.city || null;
        setCommunityId(nextCommunityId);
        setCommunityCity(nextCity);
        setHeaderAddress({
          name: defaultAddress.communityName,
          detail: [
            defaultAddress.tower ? `Tower ${defaultAddress.tower}` : null,
            `Flat ${defaultAddress.flatNumber}`,
          ]
            .filter(Boolean)
            .join(' • '),
        });
      } else if (snapshot.dayBooking) {
        setCommunityCity(null);
        setHeaderAddress({
          name: snapshot.dayBooking.addressName,
          detail: snapshot.dayBooking.addressDetail,
        });
      } else {
        setCommunityId(null);
        setCommunityCity(null);
        audienceRef.current = { communityId: null, city: null };
      }
      if (defaultAddress) {
        audienceRef.current = { communityId: nextCommunityId, city: nextCity };
      }
      void tryShowPromoBanner(audienceRef.current);
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      if (requestId === homeLoadRef.current) {
        setInitialLoading(false);
        setContentLoading(false);
      }
    }
  }, [router, tryShowPromoBanner]);

  const refreshBookingState = useCallback(async (dayOffset: number) => {
    try {
      const [snapshot, wallet] = await Promise.all([
        getHomeBookingSnapshot(dayOffset, { force: true }),
        getWallet({ force: true }),
      ]);
      setDayBooking(snapshot.dayBooking);
      setBookedDays(snapshot.bookedDays);
      setOfdBooking(snapshot.ofdBooking);
      setFeedbackBooking(snapshot.feedbackBooking);
      setWalletBalance(wallet?.balance ?? null);
    } catch (error) {
      console.error('Error refreshing booking state:', error);
    }
  }, []);

  const refreshWalletBalance = useCallback(async () => {
    try {
      const wallet = await getWallet({ force: true });
      setWalletBalance(wallet?.balance ?? null);
    } catch (error) {
      console.error('Error refreshing wallet balance:', error);
    }
  }, []);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    setSlotClock(Date.now());
    if (!bannerDismissedRef.current) bannerCheckedRef.current = false;
    try {
      await loadHomeData(selectedDay, 'content');
    } finally {
      setPullRefreshing(false);
    }
  }, [loadHomeData, selectedDay]);

  const homeRefreshControl = (
    <RefreshControl
      refreshing={pullRefreshing}
      onRefresh={() => void handlePullRefresh()}
      tintColor={colors.brand.primary}
      colors={[colors.brand.primary]}
    />
  );

  useFocusEffect(
    useCallback(() => {
      setSlotClock(Date.now());
      // First paint uses full-screen loader; day changes only refresh content below.
      loadHomeData(selectedDay, initialLoading ? 'initial' : 'content');
      // initialLoading intentionally omitted from deps — only gates the first load mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadHomeData, selectedDay]),
  );

  // Delivery may debit the wallet while the app is backgrounded — refresh on resume.
  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        setSlotClock(Date.now());
        void refreshWalletBalance();
        // A banner created while the app was backgrounded should show on return.
        if (!bannerDismissedRef.current) {
          bannerCheckedRef.current = false;
          void tryShowPromoBanner(audienceRef.current, { force: true });
        }
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [refreshWalletBalance, tryShowPromoBanner]);

  const handleClosePromoBanner = useCallback(async () => {
    const current = promoBanner;
    bannerDismissedRef.current = true;
    bannerCheckedRef.current = true;
    setPromoBanner(null);
    if (!current) return;
    try {
      await recordBannerImpression(current.id);
    } catch (error) {
      console.error('Error recording banner impression:', error);
    }
  }, [promoBanner]);

  const handleSelectDay = (index: number) => {
    if (index === selectedDay || contentLoading) return;
    // Booking for this day arrives on the next snapshot. Hide the slot grid
    // until then so a full chip does not flash before Awaiting Pickup.
    // Bump the load id so an in-flight refresh cannot clear this loader early.
    if (bookedDays.includes(index)) {
      homeLoadRef.current += 1;
      setContentLoading(true);
    }
    setSlotClock(Date.now());
    setSelectedDay(index);
    // Slot and estimate belong to the day they were chosen on.
    queuedHourRef.current = null;
    setSelectedStartHour(null);
    setEstimateCounts({});
  };

  const openNextSlot = () => {
    if (!nextOpenSlot) return;
    const now = new Date();
    const index = pickupSlots
      .filter((slot) => isPickupSlotAvailable(nextOpenSlot.offset, slot.startHour, now))
      .findIndex((slot) => slot.startHour === nextOpenSlot.startHour);
    if (index >= VISIBLE_SLOT_COUNT) setShowAllSlots(true);
    if (nextOpenSlot.offset === selectedDay) {
      setSelectedStartHour(nextOpenSlot.startHour);
      return;
    }
    queuedHourRef.current = nextOpenSlot.startHour;
    setSlotClock(Date.now());
    setSelectedDay(nextOpenSlot.offset);
  };

  const openBookingReview = () => {
    if (selectedStartHour == null || isBooking) return;
    setReviewBooking({ dayOffset: selectedDay, startHour: selectedStartHour });
  };

  const closeBookingReview = () => {
    if (isBooking) return;
    setReviewBooking(null);
  };

  const handleConfirmBooking = async () => {
    if (isBooking || !reviewBooking) return;
    const { dayOffset, startHour } = reviewBooking;
    setIsBooking(true);
    try {
      const hasEstimates = Object.values(estimateCounts).some((count) => count > 0);
      const estimatedGarments =
        hasEstimates && estimateCatalog.length > 0
          ? buildEstimateLines(estimateCatalog, estimateCounts)
          : [];
      const { amount: estimatedAmount } = estimateTotals(estimatedGarments);

      await createBooking({
        dayOffset,
        pickupStartHour: startHour,
        specialInstructions,
        ...(estimatedGarments.length > 0
          ? { estimatedGarments, estimatedAmount }
          : {}),
      });
      setReviewBooking(null);
      setSpecialInstructions('');
      setShowInstructions(false);
      setEstimateCounts({});
      bookedSlotKeyRef.current = `${dayOffset}:${startHour}`;
      // Capacity includes this order now — refresh Full chips, not just the booking strip.
      setSlotClock(Date.now());
      await refreshBookingState(dayOffset);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create booking';
      setSlotClock(Date.now());
      Alert.alert('Booking Failed', message);
    } finally {
      setIsBooking(false);
    }
  };

  const handleBookAgain = async () => {
    if (!dayBooking) return;
    try {
      await markOrderReadyForRebook(dayBooking.orderId);
      await refreshBookingState(selectedDay);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not start a new booking',
      );
    }
  };

  const handleSubmitFeedback = useCallback(
    async (rating: number, feedback: string) => {
      if (!feedbackBooking) return;
      await submitOrderFeedback(feedbackBooking.orderId, rating, feedback);
      setFeedbackBooking(null);
      await refreshBookingState(selectedDay);
    },
    [feedbackBooking, refreshBookingState, selectedDay],
  );

  const handleDismissFeedback = useCallback(async () => {
    if (!feedbackBooking) return;
    await dismissOrderFeedback(feedbackBooking.orderId);
    setFeedbackBooking(null);
    await refreshBookingState(selectedDay);
  }, [feedbackBooking, refreshBookingState, selectedDay]);

  const handleCancelBooking = () => {
    if (!dayBooking || isCancelling) return;

    const runCancel = async () => {
      setIsCancelling(true);
      const cancelledDay = selectedDay;
      try {
        await cancelBooking(dayBooking.orderId);
        // Optimistic UI — don't wait on a full home reload.
        setDayBooking(null);
        setBookedDays((prev) => prev.filter((d) => d !== cancelledDay));
        const slotKey = bookedSlotKeyRef.current;
        if (slotKey?.startsWith(`${cancelledDay}:`)) {
          bookedSlotKeyRef.current = null;
          setFullSlotKeys((prev) => {
            if (!prev.has(slotKey)) return prev;
            const next = new Set(prev);
            next.delete(slotKey);
            return next;
          });
        }
        // Refetch capacity so a slot filled by this order stops showing Full.
        setSlotClock(Date.now());
        void refreshBookingState(cancelledDay);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not cancel this booking';
        if (Platform.OS === 'web') {
          if (typeof window !== 'undefined') window.alert(message);
        } else {
          Alert.alert('Cancel failed', message);
        }
        await refreshBookingState(cancelledDay);
      } finally {
        setIsCancelling(false);
      }
    };

    // RN Web's Alert.alert often does not show multi-button dialogs.
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window === 'undefined' ||
        window.confirm(
          'Cancel booking?\n\nThis will cancel your pickup for this day. You can book again anytime.',
        );
      if (confirmed) void runCancel();
      return;
    }

    Alert.alert(
      'Cancel booking?',
      'This will cancel your pickup for this day. You can book again anytime.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: () => {
            void runCancel();
          },
        },
      ],
    );
  };

  const addressName = dayBooking?.addressName || headerAddress.name || 'Your address';
  const addressDetail =
    dayBooking?.addressDetail || headerAddress.detail || 'Add address in profile';

  const header = (
    <View style={styles.header}>
      <Pressable
        style={styles.addressContainer}
        onPress={() => router.push('/profile/addresses')}
      >
        <View style={styles.addressIconWrap}>
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={18}
            color={colors.brand.primary}
          />
        </View>
        <View style={styles.addressInfo}>
          <Text style={styles.addressName} numberOfLines={1}>
            {addressName}
          </Text>
          <Text style={styles.addressDetail} numberOfLines={1}>
            {addressDetail}
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={styles.walletContainer}
        onPress={() => router.push('/(tabs)/wallet')}
      >
        <MaterialCommunityIcons
          name="wallet-outline"
          size={18}
          color={colors.brand.accent}
        />
        <View style={styles.walletInfo}>
          <Text style={styles.walletBalance}>
            {walletBalance != null ? (
              <>
                <Text style={styles.walletCurrency}>₹</Text>
                {walletBalance}
              </>
            ) : (
              '—'
            )}
          </Text>
          <Text style={styles.walletLabel}>Wallet</Text>
        </View>
      </Pressable>
      {/* Garment rates — header icon opens price list sheet */}
      <GarmentRateCard
        communityId={communityId}
        userId={userId}
        city={communityCity}
      />
      <Pressable
        style={styles.profileButton}
        onPress={() => router.push('/(tabs)/profile')}
      >
        {headerProfile.avatarUrl ? (
          <Image
            source={{ uri: headerProfile.avatarUrl }}
            style={styles.profileAvatar}
            accessibilityLabel="Profile photo"
          />
        ) : headerProfile.fullName && headerProfile.fullName !== 'User' ? (
          <Text style={styles.profileInitials}>
            {getInitials(headerProfile.fullName)}
          </Text>
        ) : (
          <MaterialCommunityIcons
            name="account-outline"
            size={22}
            color={colors.icon.primary}
          />
        )}
      </Pressable>
    </View>
  );

  const promoBannerModal = promoBanner ? (
    <PromoBannerModal banner={promoBanner} onClose={handleClosePromoBanner} />
  ) : null;

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.checkingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
        {promoBannerModal}
      </SafeAreaView>
    );
  }

  const dateStrip = (
    <View style={styles.datePickerContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.datePickerScroll}
      >
        {days.map((day, index) => {
          const isSelected = selectedDay === index;
          const hasBooking = bookedDays.includes(index);
          const isClosed = closedDates.has(
            dayOffsetToLocalDateKey(index, new Date(slotClock)),
          );
          return (
            <Pressable
              key={index}
              style={[
                styles.dayItem,
                isSelected && styles.dayItemSelected,
                isClosed && !isSelected && styles.dayItemClosed,
              ]}
              onPress={() => handleSelectDay(index)}
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${day.isToday ? 'Today' : day.day} ${day.date}${isClosed ? ', pickup closed' : ''}`}
            >
              <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                {day.isToday ? 'Today' : day.day}
              </Text>
              <View
                style={[
                  styles.dayDateWrap,
                  isSelected && styles.dayDateWrapSelected,
                ]}
              >
                <Text
                  style={[styles.dayDate, isSelected && styles.dayDateSelected]}
                >
                  {day.date.toString().padStart(2, '0')}
                </Text>
              </View>
              {hasBooking && !isSelected && (
                <View style={styles.dayBookedIndicator} />
              )}
              {isClosed && !hasBooking && !isSelected && (
                <View style={styles.dayClosedIndicator} />
              )}
              {isSelected && <View style={styles.dayIndicator} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  const contentLoader = (
    <View style={styles.contentLoader}>
      <ActivityIndicator size="large" color={colors.brand.primary} />
    </View>
  );

  // Today's out-for-delivery order. After that, the feedback prompt.
  const statusBanner = ofdBooking ? (
    <OutForDeliveryBanner booking={ofdBooking} />
  ) : feedbackBooking ? (
    <DeliveredFeedbackBanner
      booking={feedbackBooking}
      onSubmit={handleSubmitFeedback}
      onDismiss={handleDismissFeedback}
    />
  ) : null;

  // Selected day already has a booking — show that day's order card only
  if (dayBooking && !contentLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
        {header}
        {dateStrip}
        {statusBanner}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.statusScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={homeRefreshControl}
        >
          <ActiveOrderCard
            booking={dayBooking}
            onBookAgain={
              dayBooking.phase === 'delivered' ? handleBookAgain : undefined
            }
            onCancel={
              dayBooking.phase === 'awaiting_pickup' && !dayBooking.pickupFailureReason
                ? handleCancelBooking
                : undefined
            }
            isCancelling={isCancelling}
          />
        </ScrollView>
        {promoBannerModal}
      </SafeAreaView>
    );
  }

  if (contentLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
        {header}
        {dateStrip}
        {statusBanner}
        {contentLoader}
        {promoBannerModal}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      {header}
      {dateStrip}
      {statusBanner}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={homeRefreshControl}
      >
        {/* Pickup Time Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconWrap}>
              <MaterialCommunityIcons
                name="package-variant"
                size={20}
                color={colors.status.success.foreground}
              />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Select Pickup Time</Text>
              <Text style={styles.sectionSubtitle}>We'll pick up your clothes</Text>
            </View>
          </View>

          {slotsLoading ? (
            <View style={styles.slotsEmpty}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : pickupSlots.length === 0 ? (
            <View style={styles.slotsEmpty}>
              <Text style={styles.slotsEmptyTitle}>
                {communityId ? 'No pickup slots yet' : 'Complete your address'}
              </Text>
              <Text style={styles.slotsEmptyHint}>
                {communityId
                  ? 'Pickup times for your community are not configured. Please check back soon.'
                  : 'Add your community and flat in Profile to see available pickup times.'}
              </Text>
            </View>
          ) : daySlots.length === 0 ? (
            <View style={styles.slotsEmpty}>
              <Text style={styles.slotsEmptyTitle}>
                {selectedDayClosed ? 'Pickup unavailable' : 'No slots available'}
              </Text>
              <Text style={styles.slotsEmptyHint}>
                {selectedDayClosed
                  ? 'Pickup is closed on this date. Please choose another day.'
                  : selectedDay === 0
                    ? 'All pickup times for today have already passed. Please choose another day.'
                    : 'No pickup times are available for this day. Please choose another day.'}
              </Text>
              {nextOpenSlot ? (
                <Pressable
                  style={styles.nextAvailableButton}
                  onPress={openNextSlot}
                  accessibilityRole="button"
                  accessibilityLabel={`Next available ${nextOpenSlot.label}`}
                >
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={18}
                    color={colors.brand.onPrimary}
                  />
                  <Text
                    style={styles.nextAvailableButtonText}
                    numberOfLines={2}
                  >
                    Next available: {nextOpenSlot.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeSlotsRow}
              >
                {visibleSlots.map((slot) => {
                  const selected = !slot.full && selectedStartHour === slot.startHour;
                  const chip = getSlotChipParts(slot.startHour);
                  return (
                    <Pressable
                      key={slot.id}
                      style={[
                        styles.timeSlot,
                        slot.full && styles.timeSlotFull,
                        selected && styles.timeSlotSelected,
                      ]}
                      onPress={() => {
                        if (!slot.full) setSelectedStartHour(slot.startHour);
                      }}
                      disabled={slot.full}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled: slot.full }}
                      accessibilityLabel={
                        slot.full
                          ? `${formatHourlySlotLabel(slot.startHour)}, full`
                          : formatHourlySlotLabel(slot.startHour)
                      }
                    >
                      {chip.samePeriod ? (
                        <>
                          <Text
                            style={[
                              styles.slotRange,
                              slot.full && styles.slotRangeFull,
                              selected && styles.slotRangeSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {chip.range}
                          </Text>
                          <Text
                            style={[
                              styles.slotPeriod,
                              slot.full && styles.slotPeriodFull,
                              selected && styles.slotPeriodSelected,
                            ]}
                          >
                            {slot.full ? 'Full' : chip.period}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.slotRange,
                              slot.full && styles.slotRangeFull,
                              selected && styles.slotRangeSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {chip.startLabel}
                          </Text>
                          <Text
                            style={[
                              styles.slotPeriod,
                              slot.full && styles.slotPeriodFull,
                              selected && styles.slotPeriodSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {slot.full ? 'Full' : chip.endLabel}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {showNextOpen && nextOpenSlot ? (
                <Pressable
                  style={styles.nextAvailableButton}
                  onPress={openNextSlot}
                  accessibilityRole="button"
                  accessibilityLabel={`Next available ${nextOpenSlot.label}`}
                >
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={18}
                    color={colors.brand.onPrimary}
                  />
                  <Text style={styles.nextAvailableButtonText} numberOfLines={2}>
                    Next available: {nextOpenSlot.label}
                  </Text>
                </Pressable>
              ) : null}

              {daySlots.length > VISIBLE_SLOT_COUNT && (
                <Pressable
                  style={styles.moreSlotsLink}
                  onPress={() => setShowAllSlots((v) => !v)}
                >
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={16}
                    color={colors.brand.primary}
                  />
                  <Text style={styles.moreSlotsText}>
                    {showAllSlots ? 'Show less' : 'More slots'}
                  </Text>
                  <MaterialCommunityIcons
                    name={showAllSlots ? 'chevron-up' : 'chevron-right'}
                    size={16}
                    color={colors.brand.primary}
                  />
                </Pressable>
              )}
            </>
          )}
        </View>

        {/* Compact summary cards */}
        <View style={styles.summaryStack}>
          <View style={styles.summaryCard}>
            <View style={[styles.summaryIconWrap, styles.summaryIconDelivery]}>
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={20}
                color={colors.brand.accent}
              />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>Expected delivery time</Text>
              <Text style={styles.summarySubtitle} numberOfLines={2}>
                {deliveryPreviewLabel}
              </Text>
            </View>
          </View>

          <EstimateOrderCard
            communityId={communityId}
            userId={userId}
            city={communityCity}
            counts={estimateCounts}
            onChangeCounts={setEstimateCounts}
            onCatalogLoaded={handleCatalogLoaded}
          />

          <Pressable
            style={[
              styles.summaryCard,
              specialInstructions.trim().length > 0 && styles.summaryCardActive,
            ]}
            onPress={() => setShowInstructions(true)}
          >
            <View style={[styles.summaryIconWrap, styles.summaryIconNotes]}>
              <MaterialCommunityIcons
                name="note-text-outline"
                size={20}
                color={colors.status.warning.foreground}
              />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>Special Instructions</Text>
              <Text style={styles.summarySubtitle} numberOfLines={1}>
                {specialInstructions.trim() || 'None added'}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={18}
              color={colors.icon.secondary}
            />
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={showInstructions}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInstructions(false)}
      >
        <KeyboardAvoidingView
          style={styles.instructionsSheet}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.instructionsSheetHeader}>
            <Text style={styles.instructionsSheetTitle}>Special Instructions</Text>
            <Pressable onPress={() => setShowInstructions(false)} hitSlop={12}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>
          <View style={styles.instructionsSheetBody}>
            <TextInput
              style={styles.instructionsInput}
              placeholder="Add any special instructions for our team..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={6}
              maxLength={200}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              autoFocus
            />
            <Text style={styles.charCount}>{specialInstructions.length}/200</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={reviewBooking != null}
        transparent
        animationType="fade"
        onRequestClose={closeBookingReview}
      >
        <Pressable style={styles.reviewBackdrop} onPress={closeBookingReview}>
          <Pressable style={styles.reviewCard} onPress={() => {}}>
            <Text style={styles.reviewTitle}>Review booking</Text>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Pickup</Text>
              <Text style={styles.reviewValue}>
                {reviewBooking
                  ? formatNextOpenLabel(reviewBooking.dayOffset, reviewBooking.startHour)
                  : ''}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Delivery</Text>
              <Text style={styles.reviewValue}>
                {reviewBooking
                  ? formatDeliveryPreview(reviewBooking.dayOffset, reviewBooking.startHour)
                  : ''}
              </Text>
            </View>
            <Pressable
              style={[styles.confirmButton, isBooking && styles.confirmButtonDisabled]}
              onPress={handleConfirmBooking}
              disabled={isBooking}
            >
              {isBooking ? (
                <ActivityIndicator size="small" color={colors.brand.onPrimary} />
              ) : (
                <>
                  <Text style={styles.confirmButtonText}>Confirm & Book</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={colors.brand.onPrimary}
                  />
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {promoBannerModal}

      {/* Bottom CTA */}
      <View style={styles.bottomCta}>
        <Pressable
          style={[
            styles.confirmButton,
            selectedStartHour == null && styles.confirmButtonDisabled,
          ]}
          onPress={openBookingReview}
          disabled={selectedStartHour == null}
        >
          <Text style={styles.confirmButtonText}>Book</Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={20}
            color={colors.brand.onPrimary}
          />
        </Pressable>
        <View style={styles.secureNote}>
          <MaterialCommunityIcons
            name="lock-outline"
            size={14}
            color={colors.text.muted}
          />
          <Text style={styles.secureNoteText}>Your details are 100% secure</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  checkingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  addressIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.text.heading,
  },
  addressDetail: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 1,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginRight: spacing.xs,
  },
  walletInfo: {
    marginLeft: spacing.xs,
    alignItems: 'flex-start',
  },
  walletBalance: {
    fontFamily: fonts.poppins.bold,
    fontSize: 14,
    color: colors.text.heading,
    lineHeight: 18,
  },
  walletCurrency: {
    fontFamily: fonts.inter.bold,
  },
  walletLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 9,
    color: colors.text.muted,
    lineHeight: 11,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  datePickerContainer: {
    marginTop: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  datePickerScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  dayItem: {
    alignItems: 'center',
    marginRight: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dayItemSelected: {},
  dayName: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dayNameSelected: {
    color: colors.text.heading,
  },
  dayDateWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.transparent,
  },
  dayDateWrapSelected: {
    backgroundColor: colors.brand.primary,
  },
  dayDate: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.primary,
  },
  dayDateSelected: {
    color: colors.brand.onPrimary,
  },
  dayIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.accent,
    marginTop: spacing.xs,
  },
  dayBookedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success.foreground,
    marginTop: spacing.xs,
  },
  dayItemClosed: {
    opacity: 0.45,
  },
  dayClosedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text.muted,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.status.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  sectionSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  timeSlotsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  timeSlot: {
    minWidth: 108,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.border.default,
  },
  timeSlotSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary,
  },
  timeSlotFull: {
    opacity: 0.45,
    backgroundColor: colors.surface.background,
  },
  slotRange: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    letterSpacing: -0.2,
  },
  slotRangeSelected: {
    color: colors.brand.onPrimary,
  },
  slotPeriod: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 3,
    letterSpacing: 0.8,
  },
  slotPeriodSelected: {
    color: colors.brand.onPrimary,
    opacity: 0.85,
  },
  slotRangeFull: {
    color: colors.text.secondary,
  },
  slotPeriodFull: {
    color: colors.text.secondary,
  },
  moreSlotsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  moreSlotsText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.primary,
  },
  slotsEmpty: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
  },
  slotsEmptyTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  slotsEmptyHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 17,
  },
  nextAvailableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.md,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  nextAvailableButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.onPrimary,
    flexShrink: 1,
  },
  summaryStack: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  summaryCardActive: {
    borderColor: colors.brand.primary,
  },
  summaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  summaryIconDelivery: {
    backgroundColor: colors.brand.accentMuted,
  },
  summaryIconNotes: {
    backgroundColor: colors.status.warning.background,
  },
  summaryText: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  summaryTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  summarySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  instructionsSheet: {
    flex: 1,
    backgroundColor: colors.surface.background,
    paddingTop: spacing.lg,
  },
  instructionsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  instructionsSheetTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  instructionsSheetBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  instructionsInput: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 160,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  reviewBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: 'rgba(14, 42, 74, 0.45)',
  },
  reviewCard: {
    backgroundColor: colors.surface.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.md.native,
  },
  reviewTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
    marginBottom: spacing.md,
  },
  reviewRow: {
    marginBottom: spacing.md,
  },
  reviewLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: 2,
  },
  reviewValue: {
    fontFamily: fonts.poppins.medium,
    fontSize: 16,
    color: colors.text.primary,
  },
  bottomCta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    ...shadows.button.native,
  },
  confirmButtonDisabled: {
    opacity: 0.55,
  },
  confirmButtonText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
    marginRight: spacing.sm,
  },
  secureNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  secureNoteText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
  },
  statusScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    paddingTop: spacing.md,
  },
  statusCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm.native,
  },
  statusIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statusTitle: {
    fontFamily: fonts.poppins.bold,
    fontSize: 22,
    color: colors.text.heading,
    textAlign: 'center',
  },
  statusSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  orderIdToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  orderIdToggleText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.brand.accent,
    marginRight: 4,
  },
  orderExpandCard: {
    width: '100%',
    marginTop: spacing.md,
    backgroundColor: colors.surface.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
  },
  orderNumber: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.text.heading,
    textAlign: 'center',
  },
  garmentsExpandSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  garmentsExpandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  garmentsExpandTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginLeft: spacing.xs,
  },
  garmentsEmptyText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
  },
  garmentLeft: {
    flex: 1,
  },
  sectionCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionCardHeaderCenter: {
    justifyContent: 'center',
  },
  textCenter: {
    textAlign: 'center',
  },
  riderRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  riderInfoCenter: {
    marginHorizontal: spacing.md,
    alignItems: 'center',
  },
  sectionCardIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.status.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionCardIconRider: {
    backgroundColor: colors.brand.accentMuted,
  },
  sectionCardIconAddress: {
    backgroundColor: colors.status.warning.background,
  },
  sectionCardTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.muted,
  },
  infoValue: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    textAlign: 'right',
    maxWidth: '65%',
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  riderInitials: {
    fontFamily: fonts.poppins.bold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  riderInfo: {
    flex: 1,
  },
  riderName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  riderPhone: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 2,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.status.success.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigningText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.secondary,
  },
  addressNameLarge: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  addressDetailLarge: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  garmentName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
  },
  garmentMeta: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  garmentTotal: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  garmentTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  garmentTotalLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
  },
  garmentGrandTotal: {
    fontFamily: fonts.poppins.bold,
    fontSize: 16,
    color: colors.brand.primary,
  },
});
