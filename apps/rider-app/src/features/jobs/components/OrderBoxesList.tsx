import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';
import type { OrderBoxRow } from '@ironcloud/db';

type Props = {
  boxes: OrderBoxRow[];
  emptyLabel?: string;
  /** When true, show released vs active state (delivery). */
  showReleaseState?: boolean;
};

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

export function OrderBoxesList({
  boxes,
  emptyLabel = 'No boxes attached yet',
  showReleaseState = false,
}: Props) {
  if (boxes.length === 0) {
    return <Text style={styles.empty}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.list}>
      {boxes.map((box) => {
        const released = Boolean(box.releasedAt);
        const ok = showReleaseState ? released : true;
        return (
          <View key={box.id} style={styles.row}>
            <MaterialCommunityIcons
              name={ok ? 'check-circle' : 'package-variant-closed'}
              size={20}
              color={ok ? colors.status.success.foreground : colors.icon.secondary}
            />
            <View style={styles.textWrap}>
              <Text style={styles.code}>{box.boxCode}</Text>
              {showReleaseState ? (
                <Text style={styles.meta}>{released ? 'Released' : 'Needs release'}</Text>
              ) : (
                <Text style={styles.meta}>{box.status}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  textWrap: { flex: 1 },
  code: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  meta: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    textTransform: 'capitalize',
  },
  empty: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
});
