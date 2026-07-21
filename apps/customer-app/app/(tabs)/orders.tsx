import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  formatOrderDate,
  formatOrderDateTime,
  formatSlotRange,
  getCustomerOrders,
  getProgressStepIndex,
  getStatusDescription,
  getStatusLabel,
  type Order,
} from '../../src/features/orders/services/orders.service';

const PROGRESS_STEPS = [
  { key: 'picked_up', label: 'Picked Up' },
  { key: 'ironing', label: 'Ironing' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
] as const;

export default function OrdersScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [previousOrders, setPreviousOrders] = useState<Order[]>([]);

  const loadOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await getCustomerOrders();
      setCurrentOrder(result.currentOrder);
      setPreviousOrders(result.previousOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders]),
  );

  const progressIndex = currentOrder
    ? getProgressStepIndex(currentOrder.status)
    : -1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.icon.primary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Orders</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.loadingText}>Loading orders...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Request Pickup CTA */}
          <Pressable
            style={styles.requestCard}
            onPress={() => router.push('/(tabs)/home')}
          >
            <View style={styles.requestIconWrap}>
              <MaterialCommunityIcons
                name="shopping-outline"
                size={22}
                color={colors.brand.accent}
              />
            </View>
            <View style={styles.requestCopy}>
              <Text style={styles.requestTitle}>Request Pickup Today</Text>
              <Text style={styles.requestSubtitle}>
                We'll pick up your clothes within your selected time slot.
              </Text>
            </View>
            <View style={styles.requestArrow}>
              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color={colors.brand.onPrimary}
              />
            </View>
          </Pressable>

          {/* Current Order */}
          <Text style={styles.sectionTitle}>Current Order</Text>
          {currentOrder ? (
            <View style={styles.currentCard}>
              <View style={styles.currentHeader}>
                <View style={styles.currentBadge}>
                  <View style={styles.currentDot} />
                  <Text style={styles.currentBadgeText}>CURRENT ORDER</Text>
                </View>
                <Text style={styles.currentOrderId}>
                  Order ID #{currentOrder.orderNumber}
                </Text>
              </View>

              <View style={styles.statusRow}>
                <View style={styles.statusIconWrap}>
                  <MaterialCommunityIcons
                    name="shopping"
                    size={28}
                    color={colors.status.success.foreground}
                  />
                </View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>
                    {getStatusLabel(currentOrder.status)}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {getStatusDescription(currentOrder.status)}
                  </Text>
                </View>
              </View>

              {/* Progress Stepper — circles centered above labels */}
              <View style={styles.progressRow}>
                {PROGRESS_STEPS.map((step, index) => {
                  const isDone = progressIndex >= index;
                  const isLast = index === PROGRESS_STEPS.length - 1;
                  const leftLineDone = progressIndex >= index;
                  const rightLineDone = progressIndex > index;
                  return (
                    <View key={step.key} style={styles.progressStep}>
                      <View style={styles.progressCircleWrap}>
                        {index > 0 && (
                          <View
                            style={[
                              styles.progressLineLeft,
                              leftLineDone && styles.progressLineDone,
                            ]}
                          />
                        )}
                        {!isLast && (
                          <View
                            style={[
                              styles.progressLineRight,
                              rightLineDone && styles.progressLineDone,
                            ]}
                          />
                        )}
                        <View
                          style={[
                            styles.progressCircle,
                            isDone && styles.progressCircleDone,
                          ]}
                        >
                          {isDone ? (
                            <MaterialCommunityIcons
                              name="check"
                              size={12}
                              color={colors.brand.onPrimary}
                            />
                          ) : null}
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.progressLabel,
                          isDone && styles.progressLabelDone,
                        ]}
                        numberOfLines={2}
                      >
                        {step.label}
                      </Text>
                      {index === 0 && currentOrder.pickedUpAt ? (
                        <Text style={styles.progressMeta}>
                          {formatOrderDateTime(currentOrder.pickedUpAt)}
                        </Text>
                      ) : (
                        <Text style={styles.progressMeta}> </Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Pickup / Delivery */}
              <View style={styles.slotRow}>
                <View style={styles.slotCol}>
                  <View style={styles.slotIconWrap}>
                    <MaterialCommunityIcons
                      name="shopping-outline"
                      size={18}
                      color={colors.status.success.foreground}
                    />
                  </View>
                  <Text style={styles.slotTitle}>Pickup Time</Text>
                  <Text style={styles.slotDate}>
                    {formatSlotRange(currentOrder.pickupStart, currentOrder.pickupEnd).dateLabel}
                  </Text>
                  <Text style={styles.slotTime}>
                    {formatSlotRange(currentOrder.pickupStart, currentOrder.pickupEnd).timeLabel}
                  </Text>
                </View>
                <View style={styles.slotDivider} />
                <View style={styles.slotCol}>
                  <View style={[styles.slotIconWrap, styles.slotIconDelivery]}>
                    <MaterialCommunityIcons
                      name="tshirt-crew-outline"
                      size={18}
                      color={colors.brand.accent}
                    />
                  </View>
                  <Text style={styles.slotTitle}>Delivery Time</Text>
                  <Text style={styles.slotDate}>
                    {formatSlotRange(currentOrder.deliveryStart, currentOrder.deliveryEnd).dateLabel}
                  </Text>
                  <Text style={styles.slotTime}>
                    {formatSlotRange(currentOrder.deliveryStart, currentOrder.deliveryEnd).timeLabel}
                  </Text>
                </View>
              </View>

              {/* Garments collected by rider */}
              {currentOrder.items.length > 0 && (
                <View style={styles.garmentsSection}>
                  <View style={styles.garmentsHeader}>
                    <MaterialCommunityIcons
                      name="hanger"
                      size={18}
                      color={colors.brand.primary}
                    />
                    <Text style={styles.garmentsTitle}>Garments Collected</Text>
                  </View>
                  {currentOrder.items.map((item) => (
                    <View key={item.id} style={styles.garmentRow}>
                      <View style={styles.garmentLeft}>
                        <Text style={styles.garmentName}>{item.garmentName}</Text>
                        <Text style={styles.garmentMeta}>
                          ₹{item.unitPrice} × {item.quantity}
                        </Text>
                      </View>
                      <Text style={styles.garmentTotal}>₹{item.lineTotal}</Text>
                    </View>
                  ))}
                  <View style={styles.garmentTotalRow}>
                    <Text style={styles.garmentTotalLabel}>Total</Text>
                    <Text style={styles.garmentGrandTotal}>
                      ₹{currentOrder.totalAmount || currentOrder.items.reduce((s, i) => s + i.lineTotal, 0)}
                    </Text>
                  </View>
                </View>
              )}

              <Pressable style={styles.detailsButton}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={18}
                  color={colors.text.primary}
                />
                <Text style={styles.detailsButtonText}>View Order Details</Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color={colors.icon.muted}
                />
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons
                name="clipboard-text-outline"
                size={40}
                color={colors.text.muted}
              />
              <Text style={styles.emptyTitle}>No active orders</Text>
              <Text style={styles.emptySubtitle}>
                Book a pickup to see your current order here.
              </Text>
            </View>
          )}

          {/* Previous Orders */}
          <Text style={[styles.sectionTitle, styles.previousTitle]}>
            Previous Orders
          </Text>
          {previousOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptySubtitle}>No previous orders yet.</Text>
            </View>
          ) : (
            <View style={styles.previousList}>
              {previousOrders.map((order, index) => (
                <Pressable
                  key={order.id}
                  style={[
                    styles.previousItem,
                    index === previousOrders.length - 1 && styles.previousItemLast,
                  ]}
                >
                  <View style={styles.previousIconWrap}>
                    <MaterialCommunityIcons
                      name="shopping-outline"
                      size={22}
                      color={colors.icon.secondary}
                    />
                  </View>
                  <View style={styles.previousContent}>
                    <Text style={styles.previousOrderId}>
                      Order ID #{order.orderNumber}
                    </Text>
                    <Text style={styles.previousStatus}>
                      {getStatusLabel(order.status)}
                    </Text>
                    <Text style={styles.previousDate}>
                      {formatOrderDate(order.createdAt)}
                    </Text>
                    {order.items.length > 0 && (
                      <Text style={styles.previousGarments} numberOfLines={1}>
                        {order.items
                          .map((item) => `${item.garmentName} × ${item.quantity}`)
                          .join(' · ')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.previousStats}>
                    <Text style={styles.previousStatPrimary}>
                      {order.bagCount} Bag{order.bagCount > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.previousStatSecondary}>
                      {order.itemCount} Items
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={22}
                    color={colors.icon.muted}
                  />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand.accentMuted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  requestIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  requestCopy: {
    flex: 1,
  },
  requestTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  requestSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  requestArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginBottom: spacing.md,
  },
  previousTitle: {
    marginTop: spacing.xl,
  },
  currentCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.status.success.background,
    padding: spacing.lg,
    ...shadows.sm.native,
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.success.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success.foreground,
    marginRight: 6,
  },
  currentBadgeText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 11,
    color: colors.status.success.foreground,
    letterSpacing: 0.4,
  },
  currentOrderId: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.status.success.foreground,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  statusIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.status.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  statusCopy: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  statusSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
  },
  progressCircleWrap: {
    width: '100%',
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  progressCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  progressCircleDone: {
    borderColor: colors.status.success.foreground,
    backgroundColor: colors.status.success.foreground,
  },
  progressLineLeft: {
    position: 'absolute',
    left: 0,
    right: '50%',
    marginRight: 12,
    height: 2,
    top: 11,
    backgroundColor: colors.border.default,
  },
  progressLineRight: {
    position: 'absolute',
    left: '50%',
    right: 0,
    marginLeft: 12,
    height: 2,
    top: 11,
    backgroundColor: colors.border.default,
  },
  progressLineDone: {
    backgroundColor: colors.status.success.foreground,
  },
  progressLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.text.muted,
    textAlign: 'center',
    width: '100%',
  },
  progressLabelDone: {
    color: colors.text.heading,
  },
  progressMeta: {
    fontFamily: fonts.inter.regular,
    fontSize: 10,
    color: colors.text.muted,
    marginTop: 2,
    textAlign: 'center',
    width: '100%',
  },
  slotRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  slotCol: {
    flex: 1,
  },
  slotDivider: {
    width: 1,
    backgroundColor: colors.border.divider,
    marginHorizontal: spacing.md,
  },
  slotIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.status.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  slotIconDelivery: {
    backgroundColor: colors.brand.accentMuted,
  },
  slotTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.text.heading,
    marginBottom: 2,
  },
  slotDate: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
  },
  slotTime: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.primary,
    marginTop: 2,
  },
  garmentsSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  garmentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  garmentsTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginLeft: spacing.xs,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  garmentLeft: {
    flex: 1,
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
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.background,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  detailsButtonText: {
    flex: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.primary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  previousList: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  previousItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  previousItemLast: {
    borderBottomWidth: 0,
  },
  previousIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  previousContent: {
    flex: 1,
  },
  previousOrderId: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  previousStatus: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.status.success.foreground,
    marginTop: 2,
  },
  previousDate: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  previousGarments: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 4,
  },
  previousStats: {
    alignItems: 'flex-end',
    marginRight: spacing.xs,
  },
  previousStatPrimary: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.accent,
  },
  previousStatSecondary: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.brand.accent,
    marginTop: 2,
  },
});
