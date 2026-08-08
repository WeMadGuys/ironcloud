import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';
import type { BoxScanResult } from '@ironcloud/db';

type Props = {
  result: BoxScanResult;
  mode: 'pickup' | 'delivery' | 'lookup';
  acting?: boolean;
  onAttach?: () => void;
  onRelease?: () => void;
  onDismiss?: () => void;
};

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function BoxDetailsCard({
  result,
  mode,
  acting = false,
  onAttach,
  onRelease,
  onDismiss,
}: Props) {
  const box = result.box;
  const order = result.order;
  const errorMsg = result.error || (!result.ok ? 'Could not resolve box' : null);
  const canAttach = mode === 'pickup' && result.canAct && result.action === 'attach';
  const canRelease = mode === 'delivery' && result.canAct && result.action === 'release';

  const addressParts = [
    order?.tower,
    order?.flatNumber ? `Flat ${order.flatNumber}` : null,
  ].filter(Boolean);
  const address =
    addressParts.length > 0
      ? addressParts.join(' · ')
      : order
        ? 'Address not available'
        : '—';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name={errorMsg && !canAttach && !canRelease ? 'alert-circle-outline' : 'package-variant'}
          size={22}
          color={
            errorMsg && !canAttach && !canRelease
              ? colors.status.error.foreground
              : colors.brand.primary
          }
        />
        <Text style={styles.title}>{box?.boxCode ?? 'Unknown box'}</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} style={styles.dismiss}>
            <MaterialCommunityIcons name="close" size={18} color={colors.icon.secondary} />
          </Pressable>
        ) : (
          <View style={styles.dismiss} />
        )}
      </View>

      {box ? (
        <View style={styles.details}>
          <DetailRow label="Status" value={box.status} />
          <DetailRow label="Community" value={box.communityName || '—'} />
          {order ? (
            <>
              <DetailRow label="Order" value={`#${order.orderNumber}`} />
              <DetailRow label="Customer" value={order.customerName || '—'} />
              <DetailRow
                label="Phone"
                value={order.customerPhone?.trim() || '—'}
              />
              <DetailRow label="Address" value={address} />
            </>
          ) : (
            <DetailRow label="Order" value="No linked order" />
          )}
        </View>
      ) : null}

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {canAttach ? (
        <Pressable
          style={[styles.actionBtn, acting && styles.btnDisabled]}
          onPress={onAttach}
          disabled={acting}
        >
          {acting ? (
            <ActivityIndicator color={colors.brand.onPrimary} />
          ) : (
            <Text style={styles.actionText}>Attach</Text>
          )}
        </Pressable>
      ) : null}

      {canRelease ? (
        <Pressable
          style={[styles.releaseBtn, acting && styles.btnDisabled]}
          onPress={onRelease}
          disabled={acting}
        >
          {acting ? (
            <ActivityIndicator color={colors.brand.onPrimary} />
          ) : (
            <Text style={styles.actionText}>Release</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  dismiss: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  details: { gap: 6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.muted,
    minWidth: 80,
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.heading,
  },
  errorBanner: {
    backgroundColor: colors.status.error.background,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.status.error.text,
  },
  actionBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  releaseBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.status.success.foreground,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.onPrimary,
  },
  btnDisabled: { opacity: 0.6 },
});
