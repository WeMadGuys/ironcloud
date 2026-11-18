import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatReadyIn } from '@ironcloud/db';
import { colors, typographyScale } from '@ironcloud/ui';

const fonts = typographyScale.fontFamily.native;

/** Quiet turnaround under a garment name. Renders nothing when the rule has no days. */
export function ReadyIn({ days }: { days: number | null | undefined }) {
  if (days == null || days < 1) return null;

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="clock-outline" size={12} color={colors.text.muted} />
      <Text style={styles.label}>{formatReadyIn(days)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.secondary,
  },
});
