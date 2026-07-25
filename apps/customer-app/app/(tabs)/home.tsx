import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import {
  cancelBooking,
  createBooking,
  getBookedDayOffsets,
  getDeliveryWindowFromPickup,
  getHomeBookingForDay,
  markOrderReadyForRebook,
  PICKUP_HOURS,
  type ActiveBooking,
  type SlotKey,
} from '../../src/features/booking/services/booking.service';
import { ActiveOrderCard } from '../../src/features/booking/components/ActiveOrderCard';
import { listAddresses } from '../../src/features/profile/services/address.service';
import { getWallet } from '../../src/features/wallet/services/wallet.service';

interface DayOption {
  day: string;
  date: number;
  isToday: boolean;
}

const PICKUP_SLOTS = {
  morning: { label: 'Morning', time: '8:00 AM - 11:00 AM', icon: 'weather-sunny' as const },
  afternoon: { label: 'Afternoon', time: '11:00 AM - 3:00 PM', icon: 'weather-sunny' as const },
  evening: { label: 'Evening', time: '3:00 PM - 7:00 PM', icon: 'weather-night' as const },
};

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

function buildPickupWindow(dayOffset: number, slot: SlotKey) {
  const hours = PICKUP_HOURS[slot];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(hours.start, 0, 0, 0);

  const end = new Date(start);
  end.setHours(hours.end, 0, 0, 0);
  return { start, end };
}

function formatDeliveryPreview(dayOffset: number, slot: SlotKey) {
  const pickup = buildPickupWindow(dayOffset, slot);
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

  return { dateLabel, timeLabel };
}

export default function HomeScreen() {
  const router = useRouter();
  const days = getNextDays(7);

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPickup, setSelectedPickup] = useState<SlotKey>('morning');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [dayBooking, setDayBooking] = useState<ActiveBooking | null>(null);
  const [bookedDays, setBookedDays] = useState<number[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [headerAddress, setHeaderAddress] = useState({
    name: '',
    detail: '',
  });

  const deliveryPreview = formatDeliveryPreview(selectedDay, selectedPickup);

  const loadHomeData = useCallback(async (dayOffset: number, mode: 'initial' | 'content' = 'content') => {
    if (mode === 'initial') {
      setInitialLoading(true);
    } else {
      setContentLoading(true);
    }
    try {
      const [booking, bookedOffsets, wallet, addresses] = await Promise.all([
        getHomeBookingForDay(dayOffset),
        getBookedDayOffsets(7),
        getWallet(),
        listAddresses(),
      ]);

      setDayBooking(booking);
      setBookedDays(bookedOffsets);
      setWalletBalance(wallet?.balance ?? null);

      const defaultAddress =
        addresses.find((address) => address.isDefault) || addresses[0];
      if (defaultAddress) {
        setHeaderAddress({
          name: defaultAddress.communityName,
          detail: [
            defaultAddress.tower ? `Tower ${defaultAddress.tower}` : null,
            `Flat ${defaultAddress.flatNumber}`,
          ]
            .filter(Boolean)
            .join(' • '),
        });
      } else if (booking) {
        setHeaderAddress({
          name: booking.addressName,
          detail: booking.addressDetail,
        });
      }
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setInitialLoading(false);
      setContentLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // First paint uses full-screen loader; day changes only refresh content below.
      loadHomeData(selectedDay, initialLoading ? 'initial' : 'content');
      // initialLoading intentionally omitted from deps — only gates the first load mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadHomeData, selectedDay]),
  );

  const handleSelectDay = (index: number) => {
    if (index === selectedDay || contentLoading) return;
    setSelectedDay(index);
  };

  const handleConfirmBooking = async () => {
    if (isBooking) return;
    setIsBooking(true);
    try {
      await createBooking({
        dayOffset: selectedDay,
        pickupSlot: selectedPickup,
        specialInstructions,
      });
      setSpecialInstructions('');
      setShowInstructions(false);
      await loadHomeData(selectedDay);
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
      await loadHomeData(selectedDay);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not start a new booking',
      );
    }
  };

  const handleCancelBooking = () => {
    if (!dayBooking || isCancelling) return;

    Alert.alert(
      'Cancel booking?',
      'This will cancel your pickup for this day. You can book again anytime.',
      [
        { text: 'Keep booking', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await cancelBooking(dayBooking.orderId);
              setDayBooking(null);
              await loadHomeData(selectedDay);
            } catch (error) {
              Alert.alert(
                'Cancel failed',
                error instanceof Error
                  ? error.message
                  : 'Could not cancel this booking',
              );
            } finally {
              setIsCancelling(false);
            }
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
        <MaterialCommunityIcons
          name="account-outline"
          size={22}
          color={colors.icon.primary}
        />
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

  // Selected day already has a booking — show that day's order card only
  if (dayBooking && !contentLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
        {header}
        {dateStrip}
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
        {contentLoader}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      {header}
      {dateStrip}
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
            <View>
              <Text style={styles.sectionTitle}>Select Pickup Time</Text>
              <Text style={styles.sectionSubtitle}>We'll pick up your clothes</Text>
            </View>
          </View>
          <View style={styles.timeSlotsRow}>
            {(Object.keys(PICKUP_SLOTS) as SlotKey[]).map((slot) => (
              <Pressable
                key={slot}
                style={[
                  styles.timeSlot,
                  selectedPickup === slot && styles.timeSlotSelected,
                ]}
                onPress={() => setSelectedPickup(slot)}
              >
                {selectedPickup === slot && (
                  <View style={styles.checkMark}>
                    <MaterialCommunityIcons
                      name="check"
                      size={12}
                      color={colors.brand.onPrimary}
                    />
                  </View>
                )}
                <View
                  style={[
                    styles.slotIconWrap,
                    selectedPickup === slot && styles.slotIconWrapSelected,
                    slot === 'morning' && styles.slotIconMorning,
                    slot === 'afternoon' && styles.slotIconAfternoon,
                    slot === 'evening' && styles.slotIconEvening,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={slot === 'evening' ? 'weather-night' : 'white-balance-sunny'}
                    size={24}
                    color={
                      slot === 'morning'
                        ? colors.status.success.foreground
                        : slot === 'afternoon'
                        ? colors.status.warning.foreground
                        : colors.brand.accent
                    }
                  />
                </View>
                <Text
                  style={[
                    styles.slotLabel,
                    selectedPickup === slot && styles.slotLabelSelected,
                  ]}
                >
                  {PICKUP_SLOTS[slot].label}
                </Text>
                <Text style={styles.slotTime}>{PICKUP_SLOTS[slot].time}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Delivery preview — always 24 hours after pickup */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconWrap, styles.sectionIconDelivery]}>
              <MaterialCommunityIcons
                name="truck-delivery-outline"
                size={20}
                color={colors.brand.accent}
              />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Delivery Time</Text>
              <Text style={styles.sectionSubtitle}>
                Automatically scheduled 24 hours after pickup
              </Text>
            </View>
          </View>
          <View style={styles.deliveryPreviewCard}>
            <View style={styles.deliveryPreviewRow}>
              <Text style={styles.deliveryPreviewLabel}>Date</Text>
              <Text style={styles.deliveryPreviewValue}>
                {deliveryPreview.dateLabel}
              </Text>
            </View>
            <View style={[styles.deliveryPreviewRow, styles.deliveryPreviewRowLast]}>
              <Text style={styles.deliveryPreviewLabel}>Time</Text>
              <Text style={styles.deliveryPreviewValue}>
                {deliveryPreview.timeLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Special Instructions */}
        <Pressable
          style={styles.instructionsHeader}
          onPress={() => setShowInstructions(!showInstructions)}
        >
          <View style={styles.instructionsLeft}>
            <MaterialCommunityIcons
              name="pencil-outline"
              size={20}
              color={colors.icon.secondary}
            />
            <Text style={styles.instructionsTitle}>Special Instructions</Text>
            <Text style={styles.optionalText}>(Optional)</Text>
          </View>
          <MaterialCommunityIcons
            name={showInstructions ? 'chevron-up' : 'chevron-down'}
            size={24}
            color={colors.icon.secondary}
          />
        </Pressable>
        {showInstructions && (
          <View style={styles.instructionsContainer}>
            <TextInput
              style={styles.instructionsInput}
              placeholder="Add any special instructions for our team..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={3}
              maxLength={200}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
            />
            <Text style={styles.charCount}>{specialInstructions.length}/200</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.bottomCta}>
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
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.status.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionIconDelivery: {
    backgroundColor: colors.brand.accentMuted,
  },
  deliveryPreviewCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.brand.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  deliveryPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  deliveryPreviewRowLast: {
    borderBottomWidth: 0,
  },
  deliveryPreviewLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.muted,
  },
  deliveryPreviewValue: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
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
    justifyContent: 'space-between',
  },
  timeSlot: {
    flex: 1,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border.default,
    position: 'relative',
  },
  timeSlotSelected: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.surface.background,
  },
  checkMark: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  slotIconWrapSelected: {},
  slotIconMorning: {
    backgroundColor: colors.status.success.background,
  },
  slotIconMorningDelivery: {
    backgroundColor: colors.brand.accentMuted,
  },
  slotIconAfternoon: {
    backgroundColor: colors.status.warning.background,
  },
  slotIconEvening: {
    backgroundColor: colors.brand.accentMuted,
  },
  slotLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.text.primary,
    marginBottom: 4,
  },
  slotLabelSelected: {
    color: colors.brand.primary,
  },
  slotTime: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  instructionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instructionsTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  optionalText: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginLeft: spacing.xs,
  },
  instructionsContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
    minHeight: 80,
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
    paddingVertical: spacing.md,
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
    opacity: 0.7,
  },
  confirmButtonText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
    marginRight: spacing.sm,
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
