import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typographyScale } from '@ironcloud/ui';

import {
  formatCollectedShareText,
  groupCollectedGarments,
  type CollectedItem,
} from '../collectedGarments';

type Props = {
  orderNumber: string;
  items: CollectedItem[];
  title?: string;
  /** Bill under the list. Hidden when missing or zero. */
  amount?: number | null;
  amountLabel?: string;
};

export function CollectedGarmentsList({
  orderNumber,
  items,
  title = 'Collected',
  amount,
  amountLabel = 'Total',
}: Props) {
  const { total, groups } = groupCollectedGarments(items);

  const share = useCallback(() => {
    const message = formatCollectedShareText(orderNumber, items);
    void Share.share({ message }).catch(() => {
      // The sheet was dismissed, or this platform has no share target.
    });
  }, [items, orderNumber]);

  if (groups.length === 0) return null;

  const showAmount = amount != null && amount > 0;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.totalCount}>{total}</Text>
        <Pressable
          style={styles.share}
          onPress={share}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Share collected garments"
        >
          <MaterialCommunityIcons
            name="share-variant-outline"
            size={18}
            color={colors.brand.primary}
          />
        </Pressable>
      </View>

      {groups.map((group, groupIndex) => (
        <View
          key={group.serviceLine}
          style={[styles.service, groupIndex > 0 && styles.serviceDivider]}
        >
          <View style={styles.line}>
            <Text style={styles.serviceLabel}>{group.label}</Text>
            <Text style={styles.serviceCount}>{group.count}</Text>
          </View>
          {group.categories.map((category) => (
            <View key={category.name} style={styles.category}>
              <View style={styles.line}>
                <Text style={styles.categoryLabel}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.count}</Text>
              </View>
              {category.items.map((item) => (
                <View key={item.id} style={styles.line}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>×{item.quantity}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      {showAmount ? (
        <View style={styles.bill}>
          <Text style={styles.billLabel}>{amountLabel}</Text>
          <Text style={styles.billValue}>₹{amount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  totalCount: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  share: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  service: {
    paddingTop: spacing.sm,
  },
  serviceDivider: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  category: {
    marginTop: spacing.xs,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  serviceLabel: {
    flex: 1,
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  serviceCount: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  categoryLabel: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  categoryCount: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
  itemName: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
  },
  itemQty: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
  },
  bill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  billLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
  },
  billValue: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
});
