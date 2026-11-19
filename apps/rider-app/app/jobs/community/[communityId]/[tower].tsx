import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import { FailStopButton } from '../../../../src/features/jobs/components/FailStopButton';
import { NotifyPickupEtaButton } from '../../../../src/features/jobs/components/NotifyPickupEtaButton';
import { resumeFailedPickup } from '../../../../src/features/jobs/services/fail-stop.service';
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
    case 'failed':
      return 'Failed';
  }
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
  const [refreshing, setRefreshing] = useState(false);
  const [flats, setFlats] = useState<FlatJob[]>([]);
  const [resumingOrderId, setResumingOrderId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (force = false) => {
    if (!communityId || !tower) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getFlatJobs(
        communityId,
        decodeURIComponent(tower),
        dayOffset,
        'all',
        force ? { force: true } : undefined,
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
    if (flat.buttonState === 'failed') {
      if (flat.jobType !== 'pickup' || dayOffset !== 0 || resumingOrderId) return;
      const resume = () => {
        setResumingOrderId(flat.orderId);
        void resumeFailedPickup(flat.orderId)
          .then(() => openPickup(flat, false))
          .catch((error: unknown) => {
            Alert.alert(
              'Could not collect',
              error instanceof Error ? error.message : 'Try again',
            );
          })
          .finally(() => setResumingOrderId(null));
      };
      const message =
        'The customer may be available now. Make this pickup active so you can collect it?';
      if (Platform.OS === 'web') {
        const confirmed = typeof window === 'undefined' || window.confirm(message);
        if (confirmed) resume();
        return;
      }
      Alert.alert('Make pickup active?', message, [
        { text: 'Not now', style: 'cancel' },
        { text: 'Make active', onPress: resume },
      ]);
      return;
    }

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

  const toggleItemList = (jobId: string) => {
    setExpandedItems((current) => ({
      ...current,
      [jobId]: !current[jobId],
    }));
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
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true).finally(() => setRefreshing(false));
              }}
              tintColor={colors.brand.primary}
              colors={[colors.brand.primary]}
            />
          }
        >
          {flats.map((flat) => {
            const isDelivered = flat.buttonState === 'delivered';
            const isFailed = flat.buttonState === 'failed';
            const isCollected = flat.buttonState === 'collected';
            const isFuture =
              dayOffset > 0 &&
              (flat.buttonState === 'collect' || flat.buttonState === 'deliver');
            const canRetryPickup =
              isFailed && flat.jobType === 'pickup' && dayOffset === 0;
            const disabled =
              isDelivered ||
              (isFailed && !canRetryPickup) ||
              isFuture ||
              resumingOrderId === flat.orderId;
            const canCall = Boolean(telHref(flat.customerPhone));
            const canFailPickup =
              flat.jobType === 'pickup' && flat.buttonState === 'collect' && dayOffset === 0;

            return (
              <View key={`${flat.jobId}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardMeta}>
                    <View style={styles.nameRow}>
                      <Text style={styles.customerName} numberOfLines={2}>
                        {flat.customerName || 'Name not available'}
                      </Text>
                      <Pressable
                        style={[
                          styles.contactIconBtn,
                          !canCall && styles.contactIconBtnMuted,
                        ]}
                        onPress={() => void callCustomer(flat.customerPhone)}
                        disabled={!canCall}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          canCall ? 'Call customer' : 'Phone not available'
                        }
                      >
                        <MaterialCommunityIcons
                          name={canCall ? 'phone' : 'phone-outline'}
                          size={18}
                          color={canCall ? colors.brand.primary : colors.icon.secondary}
                        />
                        </Pressable>
                      {flat.jobType === 'pickup' && flat.buttonState === 'collect' && dayOffset === 0 ? (
                        <NotifyPickupEtaButton orderId={flat.orderId} />
                      ) : null}
                    </View>
                    <Text style={styles.flatLabel}>Flat {flat.flatNumber}</Text>
                    <Text style={styles.orderId}>#{flat.orderNumber}</Text>
                    <Text style={styles.jobType}>
                      {flat.jobType === 'pickup' ? 'Pickup' : 'Delivery'}
                      {flat.garmentCount > 0 ? ` • ${flat.garmentCount} items` : ''}
                      {flat.itemsFromEstimate ? ' (estimate)' : ''}
                    </Text>
                    {canFailPickup ? (
                      <FailStopButton
                        compact
                        orderId={flat.orderId}
                        jobType="pickup"
                        onFailed={() => void load(true)}
                      />
                    ) : null}
                  </View>
                  <Pressable
                    style={[
                      styles.actionButton,
                      isCollected && styles.actionButtonEdit,
                      isDelivered && styles.actionButtonDone,
                      isFailed && styles.actionButtonFailed,
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
                        isFailed && styles.actionTextFailed,
                        isFuture && styles.actionTextUpcoming,
                      ]}
                    >
                      {resumingOrderId === flat.orderId
                        ? 'Opening…'
                        : actionLabel(flat.buttonState, dayOffset)}
                    </Text>
                  </Pressable>
                </View>

                {flat.itemSummary.length > 0 ? (
                  <View style={styles.itemsBlock}>
                    {(expandedItems[flat.jobId]
                      ? flat.itemSummary
                      : flat.itemSummary.slice(0, 4)
                    ).map((item, index) => (
                      <Text key={`${item.name}-${index}`} style={styles.itemLine}>
                        {item.quantity}× {item.name}
                      </Text>
                    ))}
                    {flat.itemSummary.length > 4 ? (
                      <Pressable
                        onPress={() => toggleItemList(flat.jobId)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: Boolean(expandedItems[flat.jobId]) }}
                        accessibilityLabel={
                          expandedItems[flat.jobId]
                            ? 'Show fewer items'
                            : `Show ${flat.itemSummary.length - 4} more items`
                        }
                      >
                        <Text style={styles.itemMore}>
                          {expandedItems[flat.jobId]
                            ? 'Show less'
                            : `+${flat.itemSummary.length - 4} more`}
                        </Text>
                      </Pressable>
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  customerName: {
    flexShrink: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  flatLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginTop: 2,
  },
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
  contactIconBtnMuted: {
    opacity: 0.7,
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
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.primary,
    marginTop: 4,
    paddingVertical: 4,
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
  actionButtonFailed: {
    backgroundColor: colors.status.warning.background,
    borderWidth: 1,
    borderColor: colors.status.warning.foreground,
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
  actionTextFailed: { color: colors.status.warning.foreground },
  actionTextUpcoming: { color: colors.text.muted },
  empty: { textAlign: 'center', fontFamily: fonts.inter.regular, color: colors.text.muted, marginTop: spacing.xl },
});
