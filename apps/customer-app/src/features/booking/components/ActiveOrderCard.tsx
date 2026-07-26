import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import type { ActiveBooking, BookingGarment } from '../services/booking.service';

type Props = {
  booking: ActiveBooking;
  onBookAgain?: () => void;
  onCancel?: () => void;
  isCancelling?: boolean;
};

function garmentIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const lower = name.toLowerCase();
  if (lower.includes('shirt') && !lower.includes('t-shirt')) return 'hanger';
  if (lower.includes('t-shirt') || lower.includes('tee')) return 'tshirt-crew-outline';
  if (lower.includes('pant') || lower.includes('trouser')) return 'human-male-height';
  if (lower.includes('kurta') || lower.includes('ethnic')) return 'human-male';
  return 'hanger';
}

function GarmentRow({ item, isLast }: { item: BookingGarment; isLast?: boolean }) {
  return (
    <View style={[styles.garmentRow, isLast && styles.garmentRowLast]}>
      <View style={styles.garmentLeft}>
        <MaterialCommunityIcons
          name={garmentIcon(item.garmentName)}
          size={18}
          color={colors.icon.secondary}
          style={styles.garmentIcon}
        />
        <Text style={styles.garmentName}>{item.garmentName}</Text>
      </View>
      <Text style={styles.garmentQty}>{item.quantity}</Text>
    </View>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function ActiveOrderCard({
  booking,
  onBookAgain,
  onCancel,
  isCancelling = false,
}: Props) {
  const router = useRouter();
  const isAwaiting = booking.phase === 'awaiting_pickup';
  const isDelivered = booking.phase === 'delivered';
  const showGarments = booking.isPickupComplete;
  const hasGarments = booking.items.length > 0;
  const canCancel = isAwaiting && !!onCancel;
  const needsPayment =
    booking.isPickupComplete && booking.paymentStatus === 'insufficient_funds';
  const showEstimateCompare =
    booking.isPickupComplete &&
    booking.estimatedAmount != null &&
    booking.totalAmount > 0 &&
    Number(booking.estimatedAmount) !== Number(booking.totalAmount);

  const [showDetails, setShowDetails] = useState(false);

  const statusColor = colors.status.success.foreground;

  const handleCall = () => {
    if (booking.riderPhone) {
      Linking.openURL(`tel:+91${booking.riderPhone.replace(/\D/g, '')}`);
    }
  };

  const initials = (booking.riderName || 'R')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const instructions =
    booking.specialInstructions?.trim() || 'No instructions added';

  return (
    <View style={styles.card}>
      {/* Status */}
      <View style={styles.statusHeader}>
        <View
          style={[
            styles.statusIconWrap,
            { backgroundColor: colors.status.success.background },
          ]}
        >
          <MaterialCommunityIcons
            name={isAwaiting ? 'clock-outline' : 'check-circle-outline'}
            size={22}
            color={statusColor}
          />
        </View>
        <Text style={[styles.statusTitle, { color: statusColor }]}>
          {booking.statusLabel}
        </Text>
      </View>

      {needsPayment && (
        <Pressable
          style={styles.paymentRequired}
          onPress={() => router.push('/(tabs)/wallet')}
        >
          <MaterialCommunityIcons
            name="wallet-outline"
            size={18}
            color={colors.status.warning.foreground}
          />
          <View style={styles.paymentRequiredText}>
            <Text style={styles.paymentRequiredTitle}>Payment required</Text>
            <Text style={styles.paymentRequiredBody}>
              Add ₹{booking.totalAmount} to your wallet to complete payment.
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.status.warning.foreground}
          />
        </Pressable>
      )}

      {showEstimateCompare && (
        <View style={styles.estimateCompare}>
          <Text style={styles.estimateCompareTitle}>Pickup Confirmed</Text>
          <Text style={styles.estimateCompareLine}>
            Estimated Amount : ₹{booking.estimatedAmount}
          </Text>
          <Text style={styles.estimateCompareLine}>
            Final Amount : ₹{booking.totalAmount}
          </Text>
          <Text style={styles.estimateCompareLine}>
            Difference :{' '}
            {Number(booking.totalAmount) - Number(booking.estimatedAmount) > 0
              ? `+₹${Number(booking.totalAmount) - Number(booking.estimatedAmount)}`
              : `-₹${Math.abs(Number(booking.totalAmount) - Number(booking.estimatedAmount))}`}
          </Text>
        </View>
      )}

      {/* Pickup / Delivery */}
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleCol}>
          <View style={styles.scheduleLabelRow}>
            <View style={[styles.scheduleDot, styles.scheduleDotPickup]} />
            <Text style={styles.scheduleLabel}>Pickup</Text>
          </View>
          <Text style={styles.scheduleDate}>{booking.pickupDateLabel}</Text>
          <View style={[styles.timePill, styles.timePillPickup]}>
            <Text style={[styles.timePillText, styles.timePillTextPickup]}>
              {booking.pickupTimeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.scheduleDivider} />

        <View style={styles.scheduleCol}>
          <View style={styles.scheduleLabelRow}>
            <View style={[styles.scheduleDot, styles.scheduleDotDelivery]} />
            <Text style={styles.scheduleLabel}>Delivery</Text>
          </View>
          <Text style={styles.scheduleDate}>{booking.deliveryDateLabel}</Text>
          <View style={[styles.timePill, styles.timePillDelivery]}>
            <Text style={[styles.timePillText, styles.timePillTextDelivery]}>
              {booking.deliveryTimeLabel}
            </Text>
          </View>
        </View>
      </View>

      {/* Partner */}
      <View style={styles.partnerSection}>
        {booking.riderAssigned ? (
          <View style={styles.partnerRow}>
            <View style={styles.partnerAvatar}>
              <Text style={styles.partnerInitials}>{initials}</Text>
            </View>
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerRole}>{booking.partnerLabel}</Text>
              <Text style={styles.partnerName}>{booking.riderName}</Text>
              {booking.riderRating != null && (
                <View style={styles.partnerMeta}>
                  <View style={styles.ratingBadge}>
                    <MaterialCommunityIcons
                      name="star"
                      size={12}
                      color={colors.status.success.foreground}
                    />
                    <Text style={styles.ratingText}>
                      {booking.riderRating.toFixed(1)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <Pressable style={styles.callButton} onPress={handleCall}>
              <MaterialCommunityIcons
                name="phone"
                size={20}
                color={colors.brand.accent}
              />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.assigningText}>Assigning partner shortly...</Text>
        )}
      </View>

      {/* Single expand: booking id + instructions + garments */}
      <Pressable
        style={styles.detailsToggle}
        onPress={() => setShowDetails((prev) => !prev)}
      >
        <MaterialCommunityIcons
          name="file-document-outline"
          size={18}
          color={colors.icon.secondary}
        />
        <Text style={styles.detailsToggleText}>Order details</Text>
        <MaterialCommunityIcons
          name={showDetails ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.icon.muted}
        />
      </Pressable>

      {showDetails && (
        <View style={styles.detailsPanel}>
          <DetailBlock label="Booking ID">
            <Text style={styles.bookingIdValue}>#{booking.orderNumber}</Text>
          </DetailBlock>

          <View style={styles.detailDivider} />

          <DetailBlock label="Special instructions">
            <Text
              style={[
                styles.detailBodyText,
                !booking.specialInstructions?.trim() && styles.detailMuted,
              ]}
            >
              {instructions}
            </Text>
          </DetailBlock>

          {showGarments && (
            <>
              <View style={styles.detailDivider} />
              <DetailBlock label="Garments">
                {hasGarments ? (
                  <>
                    {booking.items.map((item, index) => (
                      <GarmentRow
                        key={item.id}
                        item={item}
                        isLast={index === booking.items.length - 1}
                      />
                    ))}
                    <View style={styles.totalItemsRow}>
                      <Text style={styles.totalItemsLabel}>Total items</Text>
                      <Text style={styles.totalItemsValue}>
                        {booking.totalItemCount}
                      </Text>
                    </View>
                    {booking.totalAmount > 0 && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Bill amount</Text>
                        <Text style={styles.billValue}>
                          ₹{booking.totalAmount}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={[styles.detailBodyText, styles.detailMuted]}>
                    Garment count will appear after pickup.
                  </Text>
                )}
              </DetailBlock>
            </>
          )}
        </View>
      )}

      {canCancel && (
        <Pressable
          style={[styles.cancelButton, isCancelling && styles.cancelButtonDisabled]}
          onPress={onCancel}
          disabled={isCancelling}
        >
          <Text style={styles.cancelButtonText}>
            {isCancelling ? 'Cancelling…' : 'Cancel booking'}
          </Text>
        </Pressable>
      )}

      {isDelivered && onBookAgain && (
        <View style={styles.deliveredFooter}>
          <View style={styles.promoBanner}>
            <MaterialCommunityIcons
              name="heart-outline"
              size={18}
              color={colors.status.success.foreground}
            />
            <Text style={styles.promoText}>
              We hope you loved our service. Book again & get 5% off on your next
              order!
            </Text>
          </View>
          <Pressable style={styles.bookAgainButton} onPress={onBookAgain}>
            <Text style={styles.bookAgainText}>Book Again</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    ...shadows.sm.native,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  statusIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    flex: 1,
    fontFamily: fonts.poppins.bold,
    fontSize: 18,
  },
  paymentRequired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.warning.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  paymentRequiredText: {
    flex: 1,
  },
  paymentRequiredTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.status.warning.foreground,
  },
  paymentRequiredBody: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.status.warning.text,
    marginTop: 2,
  },
  estimateCompare: {
    backgroundColor: colors.status.info.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 4,
  },
  estimateCompareTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.status.info.foreground,
    marginBottom: 4,
  },
  estimateCompareLine: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.status.info.text,
  },
  scheduleRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  scheduleCol: {
    flex: 1,
  },
  scheduleDivider: {
    width: 1,
    backgroundColor: colors.border.divider,
    marginHorizontal: spacing.md,
  },
  scheduleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scheduleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  scheduleDotPickup: {
    backgroundColor: colors.status.success.foreground,
  },
  scheduleDotDelivery: {
    backgroundColor: colors.brand.accent,
  },
  scheduleLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.muted,
  },
  scheduleDate: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginBottom: spacing.xs,
  },
  timePill: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timePillPickup: {
    backgroundColor: colors.status.success.background,
  },
  timePillDelivery: {
    backgroundColor: colors.brand.accentMuted,
  },
  timePillText: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
  },
  timePillTextPickup: {
    color: colors.status.success.foreground,
  },
  timePillTextDelivery: {
    color: colors.brand.accent,
  },
  partnerSection: {
    marginBottom: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  partnerAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  partnerInitials: {
    fontFamily: fonts.poppins.bold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerRole: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.muted,
  },
  partnerName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.accent,
    marginTop: 1,
  },
  partnerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.success.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    gap: 2,
  },
  ratingText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 11,
    color: colors.status.success.foreground,
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assigningText: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  detailsToggleText: {
    flex: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  detailsPanel: {
    backgroundColor: colors.surface.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailBlock: {
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
  },
  detailBodyText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  detailMuted: {
    color: colors.text.muted,
  },
  bookingIdValue: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.brand.accent,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border.divider,
  },
  garmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  garmentRowLast: {
    borderBottomWidth: 0,
  },
  garmentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  garmentIcon: {
    marginRight: spacing.sm,
  },
  garmentName: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
  },
  garmentQty: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  totalItemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  totalItemsLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  totalItemsValue: {
    fontFamily: fonts.poppins.bold,
    fontSize: 16,
    color: colors.text.heading,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  billLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  billValue: {
    fontFamily: fonts.poppins.bold,
    fontSize: 16,
    color: colors.brand.primary,
  },
  deliveredFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.status.success.background,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  promoText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.status.success.foreground,
    lineHeight: 18,
  },
  bookAgainButton: {
    borderWidth: 1.5,
    borderColor: colors.status.success.foreground,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  bookAgainText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.status.success.foreground,
  },
  cancelButton: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.status.error.foreground,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.6,
  },
  cancelButtonText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.status.error.foreground,
  },
});
