import { StyleSheet, Text, View } from 'react-native';

import { IS_MOCK_AUTH, MOCK_OTP_CODE } from '../../config/auth';
import { colors, radius, spacing, typography } from '@ironcloud/ui';

type DevModeNoticeProps = {
  /** Custom message to display */
  message?: string;
  /** Show the OTP hint */
  showOtpHint?: boolean;
};

/**
 * Development mode notice component.
 * Only renders for mock auth (shows the fixed OTP hint).
 */
export const DevModeNotice = ({
  message,
  showOtpHint = true,
}: DevModeNoticeProps) => {
  if (!IS_MOCK_AUTH) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>DEV</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>Development Mode</Text>
        {showOtpHint && (
          <Text style={styles.hint}>
            Use OTP: <Text style={styles.code}>{MOCK_OTP_CODE}</Text>
          </Text>
        )}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.warning.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.status.warning.foreground,
    borderStyle: 'dashed',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  badge: {
    backgroundColor: colors.status.warning.foreground,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    ...typography.tiny,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.caption,
    color: colors.status.warning.foreground,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  code: {
    fontWeight: '700',
    color: colors.brand.primary,
    fontFamily: 'monospace',
  },
  message: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
