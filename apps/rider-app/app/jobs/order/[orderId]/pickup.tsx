import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  confirmPickup,
  getGarmentCatalog,
  getOrderEstimatePrefill,
  getOrderItemsPrefill,
  getOrderPickupDetails,
  getOrderPricingContext,
  updatePickupItems,
  type GarmentCatalogItem,
} from '../../../../src/features/jobs/services/pickup.service';

function formatStatus(status: string): string {
  if (!status) return '';
  return status.replace(/_/g, ' ');
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
  return `tel:+91${digits.slice(-10)}`;
}

export default function PickupScreen() {
  const router = useRouter();
  const { orderId, communityId, flat, mode } = useLocalSearchParams<{
    orderId: string;
    communityId: string;
    flat?: string;
    mode?: string;
  }>();
  const isEditMode = mode === 'edit';

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
  const [showContact, setShowContact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!communityId || !orderId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
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
      ]);

      if (cancelled) return;

      const preferConfirmed = isEditMode || itemsPrefill.hasItems;
      const sourceCounts = preferConfirmed
        ? itemsPrefill.counts
        : estimatePrefill.counts;

      const initialCounts = Object.fromEntries(
        items.map((item) => [item.serviceId, sourceCounts[item.serviceId] || 0]),
      );

      setCatalog(items);
      setCounts(initialCounts);
      setFromConfirmedItems(preferConfirmed && itemsPrefill.hasItems);
      setFromCustomerEstimate(!preferConfirmed && estimatePrefill.hasEstimate);
      setEstimatedAmount(estimatePrefill.estimatedAmount ?? details.estimatedAmount);
      setOrderNumber(details.orderNumber);
      setOrderStatus(details.status);
      setSpecialInstructions(details.specialInstructions);
      setCustomerName(details.customerName);
      setCustomerPhone(details.customerPhone);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [communityId, orderId, isEditMode]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const runningTotal = catalog.reduce(
    (sum, item) => sum + (counts[item.serviceId] || 0) * item.unitPrice,
    0,
  );

  const adjust = (serviceId: string, delta: number) => {
    setCounts((prev) => ({
      ...prev,
      [serviceId]: Math.max(0, (prev[serviceId] || 0) + delta),
    }));
  };

  const handleConfirm = async () => {
    if (!orderId || !communityId || total === 0) return;
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
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.title}>
          {isEditMode ? 'Edit items' : 'Collect'} — Flat {flat}
        </Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            <View style={styles.metaCard}>
              <View style={styles.metaHeader}>
                <View style={styles.metaHeaderText}>
                  {orderNumber ? (
                    <Text style={styles.metaOrder}>#{orderNumber}</Text>
                  ) : null}
                  {orderStatus ? (
                    <Text style={styles.metaStatus}>{formatStatus(orderStatus)}</Text>
                  ) : null}
                </View>
                <Pressable
                  style={[styles.contactIconBtn, showContact && styles.contactIconBtnActive]}
                  onPress={() => setShowContact((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showContact ? 'Hide customer contact' : 'Show customer contact'}
                >
                  <MaterialCommunityIcons
                    name={showContact ? 'phone' : 'phone-outline'}
                    size={18}
                    color={showContact ? colors.brand.primary : colors.icon.primary}
                  />
                </Pressable>
              </View>

              {showContact ? (
                <View style={styles.contactPanel}>
                  <Text style={styles.contactLabel}>Customer</Text>
                  <Text style={styles.contactName}>
                    {customerName || 'Name not available'}
                  </Text>
                  <Pressable
                    style={styles.contactPhoneRow}
                    onPress={() => {
                      const href = telHref(customerPhone);
                      if (href) void Linking.openURL(href);
                    }}
                    disabled={!telHref(customerPhone)}
                  >
                    <MaterialCommunityIcons
                      name="phone"
                      size={16}
                      color={telHref(customerPhone) ? colors.brand.primary : colors.text.muted}
                    />
                    <Text
                      style={[
                        styles.contactPhone,
                        !telHref(customerPhone) && styles.contactPhoneMuted,
                      ]}
                    >
                      {formatDisplayPhone(customerPhone)}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {specialInstructions ? (
                <Text style={styles.metaNote}>Note: {specialInstructions}</Text>
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
              catalog.map((item) => (
                <View key={item.serviceId} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <MaterialCommunityIcons name="hanger" size={20} color={colors.icon.secondary} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowPrice}>₹{item.unitPrice} each</Text>
                    </View>
                  </View>
                  <View style={styles.counter}>
                    <Pressable style={styles.counterBtn} onPress={() => adjust(item.serviceId, -1)}>
                      <MaterialCommunityIcons name="minus" size={18} color={colors.brand.primary} />
                    </Pressable>
                    <Text style={styles.counterValue}>{counts[item.serviceId] || 0}</Text>
                    <Pressable style={styles.counterBtn} onPress={() => adjust(item.serviceId, 1)}>
                      <MaterialCommunityIcons name="plus" size={18} color={colors.brand.primary} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
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
          </View>
        </>
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
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.poppins.semibold, fontSize: 16, color: colors.text.heading },
  loader: { marginTop: spacing['2xl'] },
  list: { padding: spacing.lg, paddingBottom: 120 },
  metaCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: 4,
  },
  metaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaHeaderText: { flex: 1, gap: 4 },
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
  metaNote: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 4,
  },
  contactIconBtn: {
    width: 36,
    height: 36,
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
  contactPanel: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
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
  },
  contactPhone: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.brand.primary,
  },
  contactPhoneMuted: {
    color: colors.text.muted,
  },
  sectionTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginBottom: spacing.sm,
  },
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
  },
  totalLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
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
