import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import {
  confirmPickup,
  getGarmentCatalog,
  type GarmentCatalogItem,
} from '../../../../src/features/jobs/services/pickup.service';

export default function PickupScreen() {
  const router = useRouter();
  const { orderId, communityId, flat } = useLocalSearchParams<{
    orderId: string;
    communityId: string;
    flat?: string;
  }>();

  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!communityId) return;
    getGarmentCatalog(communityId).then((items) => {
      setCatalog(items);
      setCounts(Object.fromEntries(items.map((i) => [i.serviceId, 0])));
      setLoading(false);
    });
  }, [communityId]);

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

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
      await confirmPickup(
        orderId,
        communityId,
        Object.entries(counts)
          .filter(([, qty]) => qty > 0)
          .map(([serviceId, quantity]) => ({ serviceId, quantity })),
      );
      router.back();
    } catch (error) {
      Alert.alert(
        'Pickup failed',
        error instanceof Error ? error.message : 'Could not confirm pickup',
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
        <Text style={styles.title}>Collect — Flat {flat}</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            {catalog.map((item) => (
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
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.totalLabel}>Total items: {total}</Text>
            <Pressable
              style={[styles.confirmBtn, (total === 0 || submitting) && styles.confirmDisabled]}
              onPress={handleConfirm}
              disabled={total === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.brand.onPrimary} />
              ) : (
                <Text style={styles.confirmText}>Confirm and Pick Up</Text>
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
