import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  colors,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import type { ActiveBooking } from '../services/booking.service';

type Props = {
  booking: ActiveBooking;
};

export function OutForDeliveryBanner({ booking }: Props) {
  const [expanded, setExpanded] = useState(false);

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

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.accentRail} />
        <View style={styles.cardBody}>
          <Pressable
            style={styles.collapsedRow}
            onPress={() => setExpanded((prev) => !prev)}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`Out for Delivery. Estimated ${booking.deliveryTimeLabel}`}
          >
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons
                name="moped"
                size={18}
                color={colors.brand.accent}
              />
            </View>
            <View style={styles.statusTextWrap}>
              <Text style={styles.statusTitle} numberOfLines={1}>
                Out for Delivery
              </Text>
              <Text style={styles.dot} accessibilityElementsHidden>
                ·
              </Text>
              <Text style={styles.estimate} numberOfLines={2}>
                Estimated: {booking.deliveryTimeLabel}
              </Text>
            </View>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={22}
              color={colors.brand.accent}
            />
          </Pressable>

          {expanded && (
            <View style={styles.expandedPanel}>
              <Text style={styles.description}>{booking.statusDescription}</Text>

              {booking.riderAssigned ? (
                <View style={styles.partnerRow}>
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.partnerInitials}>{initials}</Text>
                  </View>
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerRole}>{booking.partnerLabel}</Text>
                    <Text style={styles.partnerName} numberOfLines={1}>
                      {booking.riderName}
                    </Text>
                  </View>
                  {booking.riderPhone ? (
                    <Pressable
                      style={styles.callButton}
                      onPress={handleCall}
                      accessibilityLabel={`Call ${booking.riderName || 'delivery partner'}`}
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={18}
                        color={colors.brand.accent}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.assigningText}>Assigning partner shortly...</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.brand.accentMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand.accentSoft,
    overflow: 'hidden',
    ...shadows.sm.native,
  },
  accentRail: {
    width: 3,
    backgroundColor: colors.brand.primary,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brand.accentSoft,
  },
  statusTextWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.xs,
    rowGap: 2,
  },
  statusTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  dot: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.secondary,
  },
  estimate: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    flexShrink: 1,
  },
  expandedPanel: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.brand.accentSoft,
  },
  description: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand.accentSoft,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  partnerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  partnerInitials: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 13,
    color: colors.brand.onPrimary,
  },
  partnerInfo: {
    flex: 1,
    minWidth: 0,
  },
  partnerRole: {
    fontFamily: fonts.inter.regular,
    fontSize: 11,
    color: colors.text.muted,
  },
  partnerName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brand.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.accentMuted,
  },
  assigningText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
  },
});
