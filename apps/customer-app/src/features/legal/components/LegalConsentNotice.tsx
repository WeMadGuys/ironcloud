import { Linking, StyleSheet, Text, View } from 'react-native';

import {
  APP_PRIVACY_POLICY_URL,
  APP_TERMS_URL,
} from '@ironcloud/config/legal';
import { colors, spacing, typographyScale } from '@ironcloud/ui';

type LegalConsentNoticeProps = {
  prefix?: string;
};

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

/**
 * Balanced two-line consent notice (common auth-pattern):
 *   By continuing, you agree to our
 *   Terms of Service and Privacy Policy.
 */
export function LegalConsentNotice({
  prefix = 'By continuing, you agree to our',
}: LegalConsentNoticeProps) {
  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.prefix}>{prefix}</Text>
      <Text style={styles.links}>
        <Text
          style={styles.link}
          onPress={() => open(APP_TERMS_URL)}
          accessibilityRole="link"
        >
          Terms of Service
        </Text>
        {' and '}
        <Text
          style={styles.link}
          onPress={() => open(APP_PRIVACY_POLICY_URL)}
          accessibilityRole="link"
        >
          Privacy Policy
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  prefix: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.muted,
    textAlign: 'center',
  },
  links: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  link: {
    fontFamily: fonts.inter.medium,
    color: colors.brand.link,
  },
});
