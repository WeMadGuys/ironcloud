import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, typographyScale } from '@ironcloud/ui';

const fonts = typographyScale.fontFamily.native;

function savingsPercent(price: number, listPrice: number): number {
  if (!(listPrice > price) || price <= 0) return 0;
  return Math.round(((listPrice - price) / listPrice) * 100);
}

type Props = {
  price: number;
  listPrice?: number | null;
  /** Shown beside the price the customer pays, e.g. "/ pc" or "each". */
  unit: string;
  /** sheet = rate-list column. line = caption under a garment name. */
  tone?: 'sheet' | 'line';
};

export function PriceQuote({ price, listPrice, unit, tone = 'sheet' }: Props) {
  const struck = listPrice != null && listPrice > price;
  const percent = struck ? savingsPercent(price, listPrice) : 0;

  if (!struck) {
    if (tone === 'line') {
      return (
        <Text style={styles.plainLine}>
          ₹{price} {unit}
        </Text>
      );
    }
    return (
      <View style={styles.payable}>
        <Text style={styles.sheetPrice}>
          <Text style={styles.currency}>₹</Text>
          {price}
        </Text>
        <Text style={styles.sheetUnit}>{unit}</Text>
      </View>
    );
  }

  const deal = (
    <View style={styles.dealRow}>
      <Text style={styles.was}>₹{listPrice}</Text>
      {percent > 0 ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{percent}% OFF</Text>
        </View>
      ) : null}
    </View>
  );

  if (tone === 'line') {
    return (
      <View style={styles.lineWrap}>
        <Text style={styles.linePrice}>
          ₹{price} {unit}
        </Text>
        {deal}
      </View>
    );
  }

  return (
    <View style={styles.sheetWrap}>
      <View style={styles.payable}>
        <Text style={styles.salePrice}>
          <Text style={styles.currency}>₹</Text>
          {price}
        </Text>
        <Text style={styles.saleUnit}>{unit}</Text>
      </View>
      {deal}
    </View>
  );
}

const styles = StyleSheet.create({
  payable: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  sheetWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  sheetPrice: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  salePrice: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.status.success.text,
  },
  currency: {
    fontFamily: fonts.inter.bold,
  },
  sheetUnit: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
  },
  saleUnit: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.status.success.text,
  },
  dealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  was: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.secondary,
    textDecorationLine: 'line-through',
  },
  pill: {
    backgroundColor: colors.status.success.background,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: fonts.inter.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.status.success.text,
  },
  lineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  plainLine: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  linePrice: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.status.success.text,
  },
});
