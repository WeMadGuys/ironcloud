import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  clampServiceQuantity,
  isWeightService,
  maxQuantityForService,
  type BoxScanResult,
  type OrderBoxRow,
} from '@ironcloud/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import { BoxDetailsCard } from '../../../../src/features/jobs/components/BoxDetailsCard';
import { BoxQrScanner } from '../../../../src/features/jobs/components/BoxQrScanner';
import { OrderBoxesList } from '../../../../src/features/jobs/components/OrderBoxesList';
import { NotifyPickupEtaButton } from '../../../../src/features/jobs/components/NotifyPickupEtaButton';
import { FailStopButton } from '../../../../src/features/jobs/components/FailStopButton';
import { PickupPhotosSection } from '../../../../src/features/jobs/components/PickupPhotosSection';
import {
  attachBoxToOrder,
  getOrderBoxes,
  resolveBoxScan,
} from '../../../../src/features/jobs/services/box.service';
import {
  confirmPickup,
  getGarmentCatalog,
  getOrderEstimatePrefill,
  getOrderItemsPrefill,
  getOrderPickupDetails,
  getOrderPricingContext,
  isInsufficientWalletError,
  updatePickupItems,
  type GarmentCatalogItem,
} from '../../../../src/features/jobs/services/pickup.service';

function formatStatus(status: string): string {
  if (!status) return '';
  return status.replace(/_/g, ' ');
}

function telHref(phone: string | null | undefined): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  return `tel:+91${digits.slice(-10)}`;
}

type Step = 'boxes' | 'garments';

export default function PickupScreen() {
  const router = useRouter();
  const { orderId, communityId, flat, mode } = useLocalSearchParams<{
    orderId: string;
    communityId: string;
    flat?: string;
    mode?: string;
  }>();
  const isEditMode = mode === 'edit';

  const [step, setStep] = useState<Step>(isEditMode ? 'garments' : 'boxes');
  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [fromCustomerEstimate, setFromCustomerEstimate] = useState(false);
  const [fromConfirmedItems, setFromConfirmedItems] = useState(false);
  const [estimatedAmount, setEstimatedAmount] = useState<number | null>(null);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [attachedBoxes, setAttachedBoxes] = useState<OrderBoxRow[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState<BoxScanResult | null>(null);
  const [acting, setActing] = useState(false);

  const refreshBoxes = useCallback(async () => {
    if (!orderId) return;
    const rows = await getOrderBoxes(orderId, true);
    setAttachedBoxes(rows);
  }, [orderId]);

  const loadOrder = useCallback(
    async (showLoader: boolean) => {
      if (!communityId || !orderId) return;
      if (showLoader) setLoading(true);
      try {
        const pricingCtx = await getOrderPricingContext(orderId);
        const [items, estimatePrefill, itemsPrefill, details] = await Promise.all([
          getGarmentCatalog({
            communityId: pricingCtx.communityId || communityId,
            userId: pricingCtx.customerId,
            city: pricingCtx.city,
          }),
          getOrderEstimatePrefill(orderId),
          getOrderItemsPrefill(orderId),
          getOrderPickupDetails(orderId),
          refreshBoxes(),
        ]);

        const preferConfirmed = isEditMode || itemsPrefill.hasItems;
        const sourceCounts = preferConfirmed
          ? itemsPrefill.counts
          : estimatePrefill.counts;

        setCatalog(items);
        setCounts(
          Object.fromEntries(
            items.map((item) => [item.serviceId, sourceCounts[item.serviceId] || 0]),
          ),
        );
        setFromConfirmedItems(preferConfirmed && itemsPrefill.hasItems);
        setFromCustomerEstimate(!preferConfirmed && estimatePrefill.hasEstimate);
        setEstimatedAmount(estimatePrefill.estimatedAmount ?? details.estimatedAmount);
        setOrderNumber(details.orderNumber);
        setOrderStatus(details.status);
        setSpecialInstructions(details.specialInstructions);
        setCustomerName(details.customerName);
        setCustomerPhone(details.customerPhone);
      } finally {
        if (showLoader) setLoading(false);
      }
    },
    [communityId, orderId, isEditMode, refreshBoxes],
  );

  useEffect(() => {
    void loadOrder(true);
  }, [loadOrder]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadOrder(false);
      setPhotoRefreshKey((key) => key + 1);
    } finally {
      setRefreshing(false);
    }
  }, [loadOrder]);

  const canCall = Boolean(telHref(customerPhone));
  const callCustomer = () => {
    const href = telHref(customerPhone);
    if (href) void Linking.openURL(href);
  };

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const runningTotal = catalog.reduce(
    (sum, item) => sum + (counts[item.serviceId] || 0) * item.unitPrice,
    0,
  );

  const adjust = (serviceId: string, delta: number) => {
    const item = catalog.find((entry) => entry.serviceId === serviceId);
    setCounts((prev) => ({
      ...prev,
      [serviceId]: clampServiceQuantity((prev[serviceId] || 0) + delta, item ?? {}),
    }));
  };

  const handleScanCode = async (code: string) => {
    if (!orderId) return;
    setScanBusy(true);
    try {
      const result = await resolveBoxScan(code, { orderId, mode: 'pickup' });
      setScanResult(result);
      setScannerOpen(false);
      if (!result.ok || result.error) {
        // Still show details card when possible; alert for hard failures with no box
        if (!result.box) {
          Alert.alert('Scan failed', result.error || 'Unknown box code');
        }
      }
    } catch (error) {
      Alert.alert(
        'Scan failed',
        error instanceof Error ? error.message : 'Could not resolve box',
      );
    } finally {
      setScanBusy(false);
    }
  };

  const handleAttach = async () => {
    if (!orderId || !scanResult?.box?.boxCode) return;
    setActing(true);
    try {
      await attachBoxToOrder(orderId, scanResult.box.boxCode);
      await refreshBoxes();
      setScanResult(null);
      Alert.alert('Box attached', `${scanResult.box.boxCode} linked to this order.`);
    } catch (error) {
      Alert.alert(
        'Attach failed',
        error instanceof Error ? error.message : 'Could not attach box',
      );
    } finally {
      setActing(false);
    }
  };

  const handleConfirm = async () => {
    if (!orderId || !communityId || total === 0) return;
    if (!isEditMode && attachedBoxes.length === 0) {
      Alert.alert('Boxes required', 'Attach at least one box before confirming pickup.');
      setStep('boxes');
      return;
    }
    setSubmitting(true);
    try {
      const lines = Object.entries(counts)
        .filter(([, qty]) => qty > 0)
        .map(([serviceId, quantity]) => ({ serviceId, quantity }));

      if (isEditMode) {
        await updatePickupItems(orderId, communityId, lines);
      } else {
        await confirmPickup(orderId, communityId, lines);
      }
      router.back();
    } catch (error) {
      if (isInsufficientWalletError(error)) {
        const amount =
          'amount' in error && typeof error.amount === 'number'
            ? error.amount
            : runningTotal;
        const balance =
          'balance' in error && typeof error.balance === 'number'
            ? error.balance
            : 0;
        Alert.alert(
          'Insufficient wallet balance',
          `Ask the customer to add money to their wallet to confirm pickup.\n\nRequired: ₹${amount}\nWallet: ₹${balance}`,
        );
        return;
      }
      Alert.alert(
        isEditMode ? 'Update failed' : 'Pickup failed',
        error instanceof Error ? error.message : 'Could not save items',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => {
            if (step === 'garments' && !isEditMode) {
              setStep('boxes');
              return;
            }
            router.back();
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.title}>
          {isEditMode
            ? `Edit items — Flat ${flat}`
            : step === 'boxes'
              ? `Boxes — Flat ${flat}`
              : `Collect — Flat ${flat}`}
        </Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : step === 'boxes' && !isEditMode ? (
        <>
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.brand.primary}
                colors={[colors.brand.primary]}
              />
            }
          >
            <View style={styles.metaCard}>
              <View style={styles.nameRow}>
                <Text style={styles.contactName} numberOfLines={2}>
                  {customerName || 'Name not available'}
                </Text>
                <Pressable
                  style={[styles.contactIconBtn, !canCall && styles.contactIconBtnMuted]}
                  onPress={callCustomer}
                  disabled={!canCall}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={canCall ? 'Call customer' : 'Phone not available'}
                >
                  <MaterialCommunityIcons
                    name={canCall ? 'phone' : 'phone-outline'}
                    size={18}
                    color={canCall ? colors.brand.primary : colors.icon.secondary}
                  />
                </Pressable>
                {orderId && !isEditMode ? <NotifyPickupEtaButton orderId={orderId} /> : null}
              </View>
              {flat ? <Text style={styles.flatLabel}>Flat {flat}</Text> : null}
              {orderNumber ? <Text style={styles.metaOrder}>#{orderNumber}</Text> : null}
              {orderStatus ? (
                <Text style={styles.metaStatus}>{formatStatus(orderStatus)}</Text>
              ) : null}
              <Text style={styles.metaHint}>
                Scan and Attach each physical box used for this pickup. You can attach more than
                one if clothes do not fit in a single box.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>
              Attached boxes ({attachedBoxes.length})
            </Text>
            <OrderBoxesList boxes={attachedBoxes} />

            {scanResult ? (
              <View style={styles.scanResultWrap}>
                <BoxDetailsCard
                  result={scanResult}
                  mode="pickup"
                  acting={acting}
                  onAttach={() => void handleAttach()}
                  onDismiss={() => setScanResult(null)}
                />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.scanBtn} onPress={() => setScannerOpen(true)}>
              <MaterialCommunityIcons name="qrcode-scan" size={20} color={colors.brand.onPrimary} />
              <Text style={styles.confirmText}>Scan Box QR</Text>
            </Pressable>
            <Pressable
              style={[
                styles.continueBtn,
                attachedBoxes.length === 0 && styles.confirmDisabled,
              ]}
              disabled={attachedBoxes.length === 0}
              onPress={() => setStep('garments')}
            >
              <Text style={styles.continueText}>Continue to garments</Text>
            </Pressable>
            {orderId ? (
              <FailStopButton
                orderId={orderId}
                jobType="pickup"
                onFailed={() => router.back()}
              />
            ) : null}
          </View>
        </>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.brand.primary}
                colors={[colors.brand.primary]}
              />
            }
          >
            <View style={styles.metaCard}>
              <View style={styles.nameRow}>
                <Text style={styles.contactName} numberOfLines={2}>
                  {customerName || 'Name not available'}
                </Text>
                <Pressable
                  style={[styles.contactIconBtn, !canCall && styles.contactIconBtnMuted]}
                  onPress={callCustomer}
                  disabled={!canCall}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={canCall ? 'Call customer' : 'Phone not available'}
                >
                  <MaterialCommunityIcons
                    name={canCall ? 'phone' : 'phone-outline'}
                    size={18}
                    color={canCall ? colors.brand.primary : colors.icon.secondary}
                  />
                </Pressable>
                {orderId && !isEditMode ? <NotifyPickupEtaButton orderId={orderId} /> : null}
              </View>
              {flat ? <Text style={styles.flatLabel}>Flat {flat}</Text> : null}
              {orderNumber ? <Text style={styles.metaOrder}>#{orderNumber}</Text> : null}
              {orderStatus ? (
                <Text style={styles.metaStatus}>{formatStatus(orderStatus)}</Text>
              ) : null}

              {specialInstructions ? (
                <Text style={styles.metaNote}>Note: {specialInstructions}</Text>
              ) : null}

              {!isEditMode && attachedBoxes.length > 0 ? (
                <Text style={styles.metaNote}>
                  Boxes: {attachedBoxes.map((b) => b.boxCode).join(', ')}
                </Text>
              ) : null}
            </View>

            {fromConfirmedItems && (
              <View style={styles.estimateBanner}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={18}
                  color={colors.status.info.foreground}
                />
                <Text style={styles.estimateBannerText}>
                  Showing collected items. Adjust counts if something was wrong or missing,
                  then save.
                </Text>
              </View>
            )}

            {fromCustomerEstimate && !fromConfirmedItems && (
              <View style={styles.estimateBanner}>
                <MaterialCommunityIcons
                  name="information-outline"
                  size={18}
                  color={colors.status.info.foreground}
                />
                <Text style={styles.estimateBannerText}>
                  Pre-filled from customer estimate
                  {estimatedAmount != null ? ` (₹${estimatedAmount})` : ''}.
                  Adjust counts if needed, then confirm.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Garments to pick up</Text>

            {catalog.length === 0 ? (
              <Text style={styles.emptyCatalog}>
                No services available. Check pricing / services setup.
              </Text>
            ) : (
              catalog.map((item) => {
                const count = counts[item.serviceId] || 0;
                const atMin = count <= 0;
                const atMax = count >= maxQuantityForService(item);
                const unitSuffix = isWeightService(item) ? '/ kg' : 'each';

                return (
                  <View key={item.serviceId} style={styles.row}>
                    <View style={styles.rowLeft}>
                      <MaterialCommunityIcons name="hanger" size={20} color={colors.icon.secondary} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowName}>{item.name}</Text>
                        <Text style={styles.rowPrice}>
                          ₹{item.unitPrice} {unitSuffix}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.counter}>
                      <Pressable
                        style={styles.counterBtn}
                        onPress={() => adjust(item.serviceId, -1)}
                        disabled={atMin}
                      >
                        <MaterialCommunityIcons
                          name="minus"
                          size={18}
                          color={atMin ? colors.icon.inactive : colors.brand.primary}
                        />
                      </Pressable>
                      <Text style={styles.counterValue}>{count}</Text>
                      <Pressable
                        style={styles.counterBtn}
                        onPress={() => adjust(item.serviceId, 1)}
                        disabled={atMax}
                      >
                        <MaterialCommunityIcons
                          name="plus"
                          size={18}
                          color={atMax ? colors.icon.inactive : colors.brand.primary}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}

            {orderId ? (
              <PickupPhotosSection orderId={orderId} refreshKey={photoRefreshKey} />
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.totalLabel}>
              Total items: {total}
              {total > 0 ? `  ·  ₹${runningTotal}` : ''}
            </Text>
            <Pressable
              style={[styles.confirmBtn, (total === 0 || submitting) && styles.confirmDisabled]}
              onPress={handleConfirm}
              disabled={total === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.confirmText}>
                  {isEditMode ? 'Save item changes' : 'Confirm and Pick Up'}
                </Text>
              )}
            </Pressable>
            {!isEditMode && orderId ? (
              <FailStopButton
                orderId={orderId}
                jobType="pickup"
                onFailed={() => router.back()}
              />
            ) : null}
          </View>
        </>
      )}

      <BoxQrScanner
        visible={scannerOpen}
        title="Scan box to attach"
        busy={scanBusy}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => void handleScanCode(code)}
      />
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
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  loader: { marginTop: spacing['2xl'] },
  list: { padding: spacing.lg, paddingBottom: 160 },
  metaCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 4,
  },
  metaOrder: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  metaStatus: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  metaHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
    lineHeight: 18,
  },
  metaNote: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactName: {
    flexShrink: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  flatLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
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
  contactIconBtnMuted: { opacity: 0.7 },
  sectionTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginBottom: spacing.sm,
  },
  scanResultWrap: { marginTop: spacing.md },
  emptyCatalog: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  estimateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.status.info.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  estimateBannerText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.status.info.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.sm },
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.inter.semibold, fontSize: 14, color: colors.text.heading },
  rowPrice: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.text.muted },
  counter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.background,
  },
  counterValue: {
    fontFamily: fonts.inter.semibold,
    fontSize: 16,
    color: colors.text.heading,
    minWidth: 24,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    gap: spacing.sm,
  },
  totalLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  scanBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  continueBtn: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  continueText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.primary,
  },
  confirmBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.6 },
  confirmText: { fontFamily: fonts.poppins.semibold, fontSize: 16, color: colors.brand.onPrimary },
});
