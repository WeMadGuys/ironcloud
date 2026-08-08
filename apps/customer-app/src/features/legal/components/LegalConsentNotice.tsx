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

export function LegalConsentNotice({
  prefix = 'By continuing, you agree to our',
}: LegalConsentNoticeProps) {
  const open = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <View style={styles.wrap} accessibilityRole="text">
      <Text style={styles.text}>
        {prefix}{' '}
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
        .
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  text: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text.muted,
    textAlign: 'center',
  },
  link: {
    fontFamily: fonts.inter.semibold,
    color: colors.brand.link,
    textDecorationLine: 'underline',
  },
});
