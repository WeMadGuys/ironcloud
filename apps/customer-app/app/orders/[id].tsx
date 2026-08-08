import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  formatOrderDate,
  formatSlotRange,
  getCustomerOrderById,
  getStatusDescription,
  getStatusLabel,
  type Order,
} from '../../src/features/orders/services/orders.service';

export default function OrderDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) {
      setError('Order not found');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const result = await getCustomerOrderById(id);
      if (!result) {
        setError('Order not found');
        setOrder(null);
        return;
      }
      setOrder(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order');
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickup = order
    ? formatSlotRange(order.pickupStart, order.pickupEnd)
    : null;
  const delivery = order
    ? formatSlotRange(order.deliveryStart, order.deliveryEnd)
    : null;
  const garmentsTotal = order
    ? order.totalAmount ||
      order.items.reduce((sum, item) => sum + item.lineTotal, 0)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.icon.primary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : error || !order ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Order not found'}</Text>
          <Pressable style={styles.retryButton} onPress={() => void load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.orderId}>Order #{order.orderNumber}</Text>
            <Text style={styles.status}>{getStatusLabel(order.status)}</Text>
            <Text style={styles.statusDesc}>
              {getStatusDescription(order.status)}
            </Text>
            <Text style={styles.meta}>
              Placed {formatOrderDate(order.createdAt)}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Schedule</Text>
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleCol}>
                <Text style={styles.scheduleKind}>Pickup</Text>
                <Text style={styles.scheduleDate}>{pickup?.dateLabel}</Text>
                <Text style={styles.scheduleTime}>{pickup?.timeLabel}</Text>
              </View>
              <View style={styles.scheduleDivider} />
              <View style={styles.scheduleCol}>
                <Text style={styles.scheduleKind}>Delivery</Text>
                <Text style={styles.scheduleDate}>{delivery?.dateLabel}</Text>
                <Text style={styles.scheduleTime}>{delivery?.timeLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Special instructions</Text>
            <Text
              style={[
                styles.bodyText,
                !order.specialInstructions?.trim() && styles.muted,
              ]}
            >
              {order.specialInstructions?.trim() || 'No instructions added'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Garments</Text>
            {order.items.length === 0 ? (
              <Text style={styles.muted}>
                Garment list will appear after pickup is completed.
              </Text>
            ) : (
              <>
                {order.items.map((item) => (
                  <View key={item.id} style={styles.garmentRow}>
                    <Text style={styles.garmentName}>{item.garmentName}</Text>
                    <Text style={styles.garmentQty}>×{item.quantity}</Text>
                    <Text style={styles.garmentPrice}>₹{item.lineTotal}</Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₹{garmentsTotal}</Text>
                </View>
              </>
            )}
          </View>
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 17,
    color: colors.text.heading,
  },
  headerSpacer: { width: 40 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.brand.primary,
  },
  retryText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.onPrimary,
  },
  scroll: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  orderId: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  status: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.accent,
    marginTop: spacing.xs,
  },
  statusDesc: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  meta: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.text.heading,
    marginBottom: spacing.sm,
  },
  scheduleRow: { flexDirection: 'row', gap: spacing.md },
  scheduleCol: { flex: 1, gap: 2 },
  scheduleDivider: {
    width: 1,
    backgroundColor: colors.border.divider,
  },
  scheduleKind: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.muted,
  },
  scheduleDate: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  scheduleTime: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
  },
  bodyText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  muted: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
    gap: spacing.sm,
  },
  garmentName: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.heading,
  },
  garmentQty: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
  },
  garmentPrice: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    minWidth: 56,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  totalLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  totalValue: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
});
