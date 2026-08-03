import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BoxScanResult, OrderBoxRow } from '@ironcloud/db';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
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
import {
  getOrderBoxes,
  releaseBoxFromOrder,
  resolveBoxScan,
} from '../../../../src/features/jobs/services/box.service';
import {
  confirmDelivery,
  getDeliveryItems,
  type DeliveryItem,
} from '../../../../src/features/jobs/services/delivery.service';

export default function DeliveryScreen() {
  const router = useRouter();
  const { orderId, flat } = useLocalSearchParams<{ orderId: string; flat?: string }>();

  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [orderBoxes, setOrderBoxes] = useState<OrderBoxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState<BoxScanResult | null>(null);
  const [acting, setActing] = useState(false);

  const refreshBoxes = useCallback(async () => {
    if (!orderId) return;
    const rows = await getOrderBoxes(orderId, false);
    setOrderBoxes(rows);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [data] = await Promise.all([getDeliveryItems(orderId), refreshBoxes()]);
      if (cancelled) return;
      setItems(data);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshBoxes]);

  const activeBoxes = orderBoxes.filter((b) => !b.releasedAt);
  const releasedCount = orderBoxes.length - activeBoxes.length;
  const allReleased = activeBoxes.length === 0;
  const hadBoxes = orderBoxes.length > 0;
  const canComplete = allReleased;

  const total = items.reduce((s, i) => s + i.quantity, 0);

  const handleScanCode = async (code: string) => {
    if (!orderId) return;
    setScanBusy(true);
    try {
      const result = await resolveBoxScan(code, { orderId, mode: 'delivery' });
      setScanResult(result);
      setScannerOpen(false);
      if (!result.ok || (result.error && !result.canAct)) {
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

  const handleRelease = async () => {
    if (!orderId || !scanResult?.box?.boxCode) return;
    setActing(true);
    try {
      await releaseBoxFromOrder(orderId, scanResult.box.boxCode);
      await refreshBoxes();
      setScanResult(null);
      Alert.alert('Box released', `${scanResult.box.boxCode} is now available.`);
    } catch (error) {
      Alert.alert(
        'Release failed',
        error instanceof Error ? error.message : 'Could not release box',
      );
      // Refresh in case WRONG_BOX_SCAN / state changed
      await refreshBoxes();
    } finally {
      setActing(false);
    }
  };

  const handleConfirm = async () => {
    if (!orderId) return;
    if (!canComplete) {
      Alert.alert(
        'Release boxes first',
        'Scan and Release every assigned box before completing delivery.',
      );
      return;
    }
    setSubmitting(true);
    try {
      await confirmDelivery(orderId);
      router.back();
    } catch (error) {
      Alert.alert(
        'Delivery failed',
        error instanceof Error ? error.message : 'Could not confirm delivery',
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
        <Text style={styles.title}>Deliver — Flat {flat}</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.sectionTitle}>Garments to deliver</Text>
            {items.length === 0 ? (
              <Text style={styles.empty}>No garment details on this order.</Text>
            ) : (
              items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <MaterialCommunityIcons name="hanger" size={20} color={colors.icon.secondary} />
                    <Text style={styles.rowName}>{item.garmentName}</Text>
                  </View>
                  <Text style={styles.qty}>{item.quantity}</Text>
                </View>
              ))
            )}
            {items.length > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total items</Text>
                <Text style={styles.totalValue}>{total}</Text>
              </View>
            )}

            <View style={styles.boxSection}>
              <Text style={styles.sectionTitle}>
                Boxes
                {hadBoxes ? ` · ${releasedCount}/${orderBoxes.length} released` : ''}
              </Text>
              {hadBoxes ? (
                <>
                  <Text style={styles.boxHint}>
                    Scan each assigned box and tap Release. Complete Delivery unlocks when all
                    boxes are released.
                  </Text>
                  <OrderBoxesList
                    boxes={orderBoxes}
                    showReleaseState
                    emptyLabel="No boxes on this order."
                  />
                </>
              ) : (
                <Text style={styles.boxHint}>
                  No boxes were attached at pickup. You can complete delivery directly.
                </Text>
              )}

              {scanResult ? (
                <View style={styles.scanResultWrap}>
                  <BoxDetailsCard
                    result={scanResult}
                    mode="delivery"
                    acting={acting}
                    onRelease={() => void handleRelease()}
                    onDismiss={() => setScanResult(null)}
                  />
                </View>
              ) : null}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {hadBoxes && !allReleased ? (
              <Pressable style={styles.scanBtn} onPress={() => setScannerOpen(true)}>
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={20}
                  color={colors.brand.onPrimary}
                />
                <Text style={styles.confirmText}>Scan Box QR</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.confirmBtn,
                (!canComplete || submitting) && styles.confirmDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!canComplete || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.confirmText}>Confirm Delivered</Text>
              )}
            </Pressable>
          </View>
        </>
      )}

      <BoxQrScanner
        visible={scannerOpen}
        title="Scan box to release"
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
  sectionTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginBottom: spacing.md,
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
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowName: { fontFamily: fonts.inter.regular, fontSize: 14, color: colors.text.primary },
  qty: { fontFamily: fonts.inter.semibold, fontSize: 15, color: colors.text.heading },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  totalLabel: { fontFamily: fonts.inter.semibold, fontSize: 14, color: colors.text.heading },
  totalValue: { fontFamily: fonts.poppins.bold, fontSize: 16, color: colors.text.heading },
  empty: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.text.muted },
  boxSection: { marginTop: spacing.xl },
  boxHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  scanResultWrap: { marginTop: spacing.md },
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
  scanBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  confirmBtn: {
    backgroundColor: colors.status.success.foreground,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.6 },
  confirmText: { fontFamily: fonts.poppins.semibold, fontSize: 16, color: colors.brand.onPrimary },
});
