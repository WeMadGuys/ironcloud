import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import {
  getFlatJobs,
  type FlatJob,
} from '../../../../src/features/jobs/services/jobs.service';

function actionLabel(state: FlatJob['buttonState'], dayOffset: number) {
  if (dayOffset > 0 && (state === 'collect' || state === 'deliver')) {
    return 'Upcoming';
  }
  switch (state) {
    case 'collect':
      return 'Collect';
    case 'deliver':
      return 'Deliver';
    case 'collected':
      return 'View / Edit';
    case 'delivered':
      return 'Delivered';
  }
}

function formatDisplayPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Phone not available';
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone.trim();
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

function telHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  const national = digits.slice(-10);
  return `tel:+91${national}`;
}

export default function FlatListScreen() {
  const router = useRouter();
  const { communityId, tower, day } = useLocalSearchParams<{
    communityId: string;
    tower: string;
    day?: string;
  }>();
  const dayOffset = Number(day ?? 0);
  const [loading, setLoading] = useState(true);
  const [flats, setFlats] = useState<FlatJob[]>([]);
  const [expandedContactJobId, setExpandedContactJobId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!communityId || !tower) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getFlatJobs(
        communityId,
        decodeURIComponent(tower),
        dayOffset,
      );
      setFlats(data);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [communityId, tower, dayOffset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openPickup = (flat: FlatJob, editMode: boolean) => {
    router.push({
      pathname: '/jobs/order/[orderId]/pickup',
      params: {
        orderId: flat.orderId,
        communityId: flat.communityId,
        flat: flat.flatNumber,
        ...(editMode ? { mode: 'edit' } : {}),
      },
    });
  };

  const handleAction = (flat: FlatJob) => {
    // Future-day jobs are visible for planning but not actionable yet.
    if (dayOffset > 0 && flat.buttonState !== 'collected' && flat.buttonState !== 'delivered') {
      return;
    }
    if (flat.buttonState === 'delivered') return;

    if (flat.buttonState === 'collect') {
      openPickup(flat, false);
      return;
    }

    if (flat.buttonState === 'collected') {
      openPickup(flat, true);
      return;
    }

    router.push({
      pathname: '/jobs/order/[orderId]/delivery',
      params: {
        orderId: flat.orderId,
        flat: flat.flatNumber,
      },
    });
  };

  const toggleContact = (jobId: string) => {
    setExpandedContactJobId((prev) => (prev === jobId ? null : jobId));
  };

  const callCustomer = async (phone: string | null) => {
    const href = telHref(phone);
    if (!href) return;
    try {
      await Linking.openURL(href);
    } catch {
      // Device may not support dialer (e.g. some emulators / web)
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.title}>Tower {decodeURIComponent(tower || '')}</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {flats.map((flat) => {
            const isDelivered = flat.buttonState === 'delivered';
            const isCollected = flat.buttonState === 'collected';
            const isFuture =
              dayOffset > 0 &&
              (flat.buttonState === 'collect' || flat.buttonState === 'deliver');
            const disabled = isDelivered || isFuture;
            const contactOpen = expandedContactJobId === flat.jobId;
            const hasContact = Boolean(flat.customerName || flat.customerPhone);

            return (
              <View key={`${flat.jobId}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardMeta}>
                    <View style={styles.flatRow}>
                      <Text style={styles.flatLabel}>Flat {flat.flatNumber}</Text>
                      <Pressable
                        style={[
                          styles.contactIconBtn,
                          contactOpen && styles.contactIconBtnActive,
                          !hasContact && styles.contactIconBtnMuted,
                        ]}
                        onPress={() => toggleContact(flat.jobId)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          contactOpen ? 'Hide customer contact' : 'Show customer contact'
                        }
                      >
                        <MaterialCommunityIcons
                          name={contactOpen ? 'phone' : 'phone-outline'}
                          size={18}
                          color={
                            contactOpen
                              ? colors.brand.primary
                              : hasContact
                                ? colors.icon.primary
                                : colors.icon.secondary
                          }
                        />
                      </Pressable>
                    </View>
                    <Text style={styles.orderId}>#{flat.orderNumber}</Text>
                    <Text style={styles.jobType}>
                      {flat.jobType === 'pickup' ? 'Pickup' : 'Delivery'}
                      {flat.garmentCount > 0 ? ` • ${flat.garmentCount} items` : ''}
                      {flat.itemsFromEstimate ? ' (estimate)' : ''}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.actionButton,
                      isCollected && styles.actionButtonEdit,
                      isDelivered && styles.actionButtonDone,
                      isFuture && styles.actionButtonUpcoming,
                      disabled && styles.actionButtonDisabled,
                    ]}
                    onPress={() => handleAction(flat)}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        isCollected && styles.actionTextEdit,
                        isDelivered && styles.actionTextDone,
                        isFuture && styles.actionTextUpcoming,
                      ]}
                    >
                      {actionLabel(flat.buttonState, dayOffset)}
                    </Text>
                  </Pressable>
                </View>

                {contactOpen ? (
                  <View style={styles.contactPanel}>
                    <Text style={styles.contactLabel}>Customer</Text>
                    <Text style={styles.contactName}>
                      {flat.customerName || 'Name not available'}
                    </Text>
                    <Pressable
                      style={styles.contactPhoneRow}
                      onPress={() => void callCustomer(flat.customerPhone)}
                      disabled={!telHref(flat.customerPhone)}
                      accessibilityRole="button"
                      accessibilityLabel="Call customer"
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={16}
                        color={
                          telHref(flat.customerPhone)
                            ? colors.brand.primary
                            : colors.text.muted
                        }
                      />
                      <Text
                        style={[
                          styles.contactPhone,
                          !telHref(flat.customerPhone) && styles.contactPhoneMuted,
                        ]}
                      >
                        {formatDisplayPhone(flat.customerPhone)}
                      </Text>
                      {telHref(flat.customerPhone) ? (
                        <Text style={styles.callHint}>Tap to call</Text>
                      ) : null}
                    </Pressable>
                  </View>
                ) : null}

                {flat.itemSummary.length > 0 ? (
                  <View style={styles.itemsBlock}>
                    {flat.itemSummary.slice(0, 4).map((item, index) => (
                      <Text key={`${item.name}-${index}`} style={styles.itemLine}>
                        {item.quantity}× {item.name}
                      </Text>
                    ))}
                    {flat.itemSummary.length > 4 ? (
                      <Text style={styles.itemMore}>
                        +{flat.itemSummary.length - 4} more
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.noItemsHint}>
                    {flat.jobType === 'pickup'
                      ? 'No estimate yet — set counts when collecting'
                      : 'No items listed'}
                  </Text>
                )}

                {flat.specialInstructions ? (
                  <Text style={styles.instructions} numberOfLines={2}>
                    Note: {flat.specialInstructions}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {flats.length === 0 && (
            <Text style={styles.empty}>No flats with jobs in this tower.</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.poppins.semibold, fontSize: 17, color: colors.text.heading },
  loader: { marginTop: spacing['2xl'] },
  list: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  card: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  cardMeta: { flex: 1 },
  flatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  flatLabel: { fontFamily: fonts.inter.semibold, fontSize: 16, color: colors.text.heading },
  contactIconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  contactIconBtnActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.status.info.background,
  },
  contactIconBtnMuted: {
    opacity: 0.7,
  },
  contactPanel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 4,
  },
  contactLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  contactName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  contactPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  contactPhone: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.brand.primary,
  },
  contactPhoneMuted: {
    color: colors.text.muted,
  },
  callHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.muted,
    marginLeft: spacing.xs,
  },
  orderId: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.brand.accent, marginTop: 2 },
  jobType: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.text.muted, marginTop: 2 },
  itemsBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    gap: 2,
  },
  itemLine: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.primary,
  },
  itemMore: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  noItemsHint: {
    marginTop: spacing.sm,
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
  },
  instructions: {
    marginTop: spacing.sm,
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
  },
  actionButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionButtonEdit: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  actionButtonDone: {
    backgroundColor: colors.status.success.background,
    borderWidth: 1,
    borderColor: colors.status.success.foreground,
  },
  actionButtonUpcoming: {
    backgroundColor: colors.surface.background,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionButtonDisabled: { opacity: 0.9 },
  actionText: { fontFamily: fonts.inter.semibold, fontSize: 13, color: colors.brand.onPrimary },
  actionTextEdit: { color: colors.brand.primary },
  actionTextDone: { color: colors.status.success.foreground },
  actionTextUpcoming: { color: colors.text.muted },
  empty: { textAlign: 'center', fontFamily: fonts.inter.regular, color: colors.text.muted, marginTop: spacing.xl },
});
