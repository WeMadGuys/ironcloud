import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  getCommunityPickupSlots,
  type CommunityPickupSlot,
} from '../../src/features/booking/services/communitySlots.service';
import { ActiveOrderCard } from '../../src/features/booking/components/ActiveOrderCard';
import { DeliveredFeedbackBanner } from '../../src/features/booking/components/DeliveredFeedbackBanner';
import { OutForDeliveryBanner } from '../../src/features/booking/components/OutForDeliveryBanner';
import {
  EstimateOrderCard,
  buildEstimateLines,
  estimateTotals,
  type EstimateCounts,
} from '../../src/features/booking/components/EstimateOrderCard';
import type { GarmentCatalogItem } from '../../src/features/booking/services/catalog.service';
import { listAddresses } from '../../src/features/profile/services/address.service';
import { fetchUserProfile, getCachedProfile } from '../../src/features/profile/services/profile.service';
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
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [showAllSlots, setShowAllSlots] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
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
  /** Recompute past-slot filtering when the screen is focused. */
  const [slotClock, setSlotClock] = useState(() => Date.now());

  useEffect(() => {
    if (!communityId) {
      setPickupSlots([]);
      setSelectedStartHour(null);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    getCommunityPickupSlots(communityId)
      .then((slots) => {
        if (cancelled) return;
        setPickupSlots(slots);
      })
      .catch((error) => {
        console.error('Error loading pickup slots:', error);
        if (!cancelled) setPickupSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

  const availableSlots = useMemo(() => {
    const now = new Date(slotClock);
    return pickupSlots.filter((slot) =>
      isPickupSlotAvailable(selectedDay, slot.startHour, now),
    );
  }, [pickupSlots, selectedDay, slotClock]);

  // Keep selection on a still-bookable slot for the selected day.
  useEffect(() => {
    setSelectedStartHour((prev) => {
      if (prev != null && availableSlots.some((s) => s.startHour === prev)) {
        return prev;
      }
      return availableSlots[0]?.startHour ?? null;
    });
  }, [availableSlots]);

  const deliveryPreviewLabel = useMemo(() => {
    if (selectedStartHour == null) return 'Select a pickup time';
    return formatDeliveryPreview(selectedDay, selectedStartHour);
  }, [selectedDay, selectedStartHour]);

  const visibleSlots = showAllSlots
    ? availableSlots
    : availableSlots.slice(0, VISIBLE_SLOT_COUNT);

  const hasLoadedOnceRef = useRef(false);

  const handleCatalogLoaded = useCallback((items: GarmentCatalogItem[]) => {
    setEstimateCatalog(items);
  }, []);

  const loadHomeData = useCallback(async (dayOffset: number, mode: 'initial' | 'content' = 'content') => {
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
          getWallet(),
          listAddresses(),
          fetchUserProfile(),
          supabase.auth.getSession(),
        ]);

      setDayBooking(snapshot.dayBooking);
      setBookedDays(snapshot.bookedDays);
      setOfdBooking(snapshot.ofdBooking);
      setFeedbackBooking(snapshot.feedbackBooking);
      setWalletBalance(wallet?.balance ?? null);
      setUserId(sessionResult.data.session?.user?.id ?? null);
      setHeaderProfile({
        avatarUrl: profile?.avatarUrl ?? null,
        fullName: profile?.fullName ?? '',
      });

      const defaultAddress =
        addresses.find((address) => address.isDefault) || addresses[0];
      if (defaultAddress) {
        setCommunityId(defaultAddress.communityId);
        setCommunityCity(defaultAddress.city || null);
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
      }
      hasLoadedOnceRef.current = true;
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setInitialLoading(false);
      setContentLoading(false);
    }
  }, []);

  const refreshBookingState = useCallback(async (dayOffset: number) => {
    try {
      const snapshot = await getHomeBookingSnapshot(dayOffset, { force: true });
      setDayBooking(snapshot.dayBooking);
      setBookedDays(snapshot.bookedDays);
      setOfdBooking(snapshot.ofdBooking);
      setFeedbackBooking(snapshot.feedbackBooking);
    } catch (error) {
      console.error('Error refreshing booking state:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSlotClock(Date.now());
      // First paint uses full-screen loader; day changes only refresh content below.
      loadHomeData(selectedDay, initialLoading ? 'initial' : 'content');
      // initialLoading intentionally omitted from deps — only gates the first load mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadHomeData, selectedDay]),
  );

  // Promo banner: load after home is ready so it never blocks first paint.
  useEffect(() => {
    if (initialLoading || bannerCheckedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user?.id ?? null;
        const candidate = await pickEligibleHomeBanner({
          userId,
          communityId,
          city: communityCity,
        });
        if (cancelled) return;
        if (!candidate) {
          bannerCheckedRef.current = true;
          return;
        }

        const ok = await shouldShowBanner(
          candidate.id,
          candidate.maxImpressions,
        );
        if (!ok || cancelled) {
          bannerCheckedRef.current = true;
          return;
        }

        // Prefetch image so the modal opens with less flicker.
        await Image.prefetch(candidate.imageUrl).catch(() => undefined);
        if (cancelled) return;

        bannerCheckedRef.current = true;
        setPromoBanner(candidate);
      } catch (error) {
        console.error('Error loading promo banner:', error);
        bannerCheckedRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialLoading, communityId, communityCity]);

  const handleClosePromoBanner = useCallback(async () => {
    const current = promoBanner;
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
    setSlotClock(Date.now());
    setSelectedDay(index);
  };

  const handleConfirmBooking = async () => {
    if (isBooking) return;
    if (selectedStartHour == null) {
      Alert.alert(
        'No slots available',
        availableSlots.length === 0
          ? selectedDay === 0
            ? 'All pickup times for today have already passed. Please choose another day.'
            : 'No pickup times are available for this day.'
          : 'Please select a pickup time to continue.',
      );
      return;
    }
    setIsBooking(true);
    try {
      const hasEstimates = Object.values(estimateCounts).some((count) => count > 0);
      const estimatedGarments =
        hasEstimates && estimateCatalog.length > 0
          ? buildEstimateLines(estimateCatalog, estimateCounts)
          : [];
      const { amount: estimatedAmount } = estimateTotals(estimatedGarments);

      await createBooking({
        dayOffset: selectedDay,
        pickupStartHour: selectedStartHour,
        specialInstructions,
        ...(estimatedGarments.length > 0
          ? { estimatedGarments, estimatedAmount }
          : {}),
      });
      setSpecialInstructions('');
      setShowInstructions(false);
      setEstimateCounts({});
      // Only refresh booking strip — skip wallet/profile/address refetch.
      await refreshBookingState(selectedDay);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create booking';
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
            {walletBalance != null ? `₹${walletBalance}` : '—'}
          </Text>
          <Text style={styles.walletLabel}>Wallet</Text>
        </View>
      </Pressable>
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

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.checkingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
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
          return (
            <Pressable
              key={index}
              style={[styles.dayItem, isSelected && styles.dayItemSelected]}
              onPress={() => handleSelectDay(index)}
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

  // OFD takes priority; after delivery the same slot becomes the feedback prompt.
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
        >
          <ActiveOrderCard
            booking={dayBooking}
            onBookAgain={
              dayBooking.phase === 'delivered' ? handleBookAgain : undefined
            }
            onCancel={
              dayBooking.phase === 'awaiting_pickup'
                ? handleCancelBooking
                : undefined
            }
            isCancelling={isCancelling}
          />
        </ScrollView>
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
          ) : availableSlots.length === 0 ? (
            <View style={styles.slotsEmpty}>
              <Text style={styles.slotsEmptyTitle}>No slots available</Text>
              <Text style={styles.slotsEmptyHint}>
                {selectedDay === 0
                  ? 'All pickup times for today have already passed. Please choose another day.'
                  : 'No pickup times are available for this day. Please choose another day.'}
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeSlotsRow}
              >
                {visibleSlots.map((slot) => {
                  const selected = selectedStartHour === slot.startHour;
                  const chip = getSlotChipParts(slot.startHour);
                  return (
                    <Pressable
                      key={slot.id}
                      style={[
                        styles.timeSlot,
                        selected && styles.timeSlotSelected,
                      ]}
                      onPress={() => setSelectedStartHour(slot.startHour)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={formatHourlySlotLabel(slot.startHour)}
                    >
                      {chip.samePeriod ? (
                        <>
                          <Text
                            style={[
                              styles.slotRange,
                              selected && styles.slotRangeSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {chip.range}
                          </Text>
                          <Text
                            style={[
                              styles.slotPeriod,
                              selected && styles.slotPeriodSelected,
                            ]}
                          >
                            {chip.period}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.slotRange,
                              selected && styles.slotRangeSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {chip.startLabel}
                          </Text>
                          <Text
                            style={[
                              styles.slotPeriod,
                              selected && styles.slotPeriodSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {chip.endLabel}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {availableSlots.length > VISIBLE_SLOT_COUNT && (
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
              <Text style={styles.summaryTitle}>Delivery Time</Text>
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

      {promoBanner ? (
        <PromoBannerModal banner={promoBanner} onClose={handleClosePromoBanner} />
      ) : null}

      {/* Bottom CTA */}
      <View style={styles.bottomCta}>
        <Pressable
          style={[
            styles.confirmButton,
            (isBooking || selectedStartHour == null) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmBooking}
          disabled={isBooking || selectedStartHour == null}
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
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
