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
  confirmDelivery,
  getDeliveryItems,
  type DeliveryItem,
} from '../../../../src/features/jobs/services/delivery.service';

export default function DeliveryScreen() {
  const router = useRouter();
  const { orderId, flat } = useLocalSearchParams<{ orderId: string; flat?: string }>();

  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    getDeliveryItems(orderId).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [orderId]);

  const total = items.reduce((s, i) => s + i.quantity, 0);

  const handleConfirm = async () => {
    if (!orderId) return;
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
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              style={[styles.confirmBtn, submitting && styles.confirmDisabled]}
              onPress={handleConfirm}
              disabled={submitting}
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
  confirmBtn: {
    backgroundColor: colors.status.success.foreground,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.6 },
  confirmText: { fontFamily: fonts.poppins.semibold, fontSize: 16, color: colors.brand.onPrimary },
});
