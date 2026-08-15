import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import {
  formatTransactionDate,
  type WalletTransaction,
} from '../services/wallet.service';

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

export function getTransactionIcon(type: WalletTransaction['type']) {
  switch (type) {
    case 'recharge':
      return 'plus-circle' as const;
    case 'debit':
      return 'minus-circle' as const;
    case 'refund':
      return 'arrow-u-left-top' as const;
    case 'cashback':
      return 'gift' as const;
    default:
      return 'cash' as const;
  }
}

export function getTransactionColor(type: WalletTransaction['type']) {
  switch (type) {
    case 'recharge':
    case 'refund':
    case 'cashback':
      return colors.status.success.foreground;
    case 'debit':
      return colors.status.error.foreground;
    default:
      return colors.text.primary;
  }
}

export function getDefaultDescription(type: WalletTransaction['type']) {
  switch (type) {
    case 'recharge':
      return 'Wallet Recharge';
    case 'debit':
      return 'Order Payment';
    case 'refund':
      return 'Refund';
    case 'cashback':
      return 'Cashback';
    case 'expiry':
      return 'Points Expired';
    default:
      return 'Transaction';
  }
}

export function TransactionRow({
  transaction,
  isLast,
}: {
  transaction: WalletTransaction;
  isLast?: boolean;
}) {
  const color = getTransactionColor(transaction.type);
  const prefix = transaction.type === 'debit' ? '-' : '+';

  return (
    <View style={[styles.item, isLast && styles.itemLast]}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}15` }]}>
        <MaterialCommunityIcons
          name={getTransactionIcon(transaction.type)}
          size={22}
          color={color}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.description}>
          {transaction.description || getDefaultDescription(transaction.type)}
        </Text>
        <Text style={styles.date}>{formatTransactionDate(transaction.createdAt)}</Text>
      </View>
      <Text style={[styles.amount, { color }]}>
        {prefix}
        <Text style={styles.currency}>₹</Text>
        {transaction.amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  description: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: 2,
  },
  date: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
  },
  amount: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 15,
  },
  currency: {
    fontFamily: fonts.inter.bold,
  },
});
