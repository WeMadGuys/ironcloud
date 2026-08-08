import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  APP_BUSINESS_ADDRESS,
  APP_ENTERPRISE_NAME,
  APP_LEGAL_NAME,
  APP_SUPPORT_EMAIL,
  APP_SUPPORT_PHONE,
  APP_SUPPORT_PHONE_TEL,
  APP_UDYAM_NUMBER,
  APP_WEBSITE_URL,
} from '@ironcloud/config/legal';
import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

type PolicyRow = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: '/profile/privacy' | '/profile/terms' | '/profile/refund' | '/profile/shipping';
  webPath: string;
};

const POLICY_ROWS: PolicyRow[] = [
  {
    title: 'Privacy Policy',
    subtitle: 'How we collect and use your data',
    icon: 'shield-account-outline',
    route: '/profile/privacy',
    webPath: '/privacy-policy',
  },
  {
    title: 'Terms of Service',
    subtitle: `Rules for using ${APP_LEGAL_NAME}`,
    icon: 'file-document-outline',
    route: '/profile/terms',
    webPath: '/terms-and-conditions',
  },
  {
    title: 'Cancellation & Refund Policy',
    subtitle: 'Cancellations, refunds, and timelines',
    icon: 'cash-refund',
    route: '/profile/refund',
    webPath: '/refund-policy',
  },
  {
    title: 'Shipping & Delivery Policy',
    subtitle: 'Pickup and return delivery turnaround',
    icon: 'truck-delivery-outline',
    route: '/profile/shipping',
    webPath: '/shipping-policy',
  },
];

export default function AboutScreen() {
  const router = useRouter();
  const webBase = APP_WEBSITE_URL;

  const openWeb = async (path: string, fallback: PolicyRow['route']) => {
    const url = `${webBase}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      router.push(fallback);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>About</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>{APP_LEGAL_NAME}</Text>
        <Text style={styles.tagline}>Doorstep ironing for your apartment</Text>
        <Text style={styles.body}>
          We pick up, press, and deliver your clothes on a schedule that fits your
          community. Use the links below to review our policies.
        </Text>

        {POLICY_ROWS.map((row) => (
          <Pressable
            key={row.route}
            style={styles.row}
            onPress={() => router.push(row.route)}
          >
            <MaterialCommunityIcons
              name={row.icon}
              size={22}
              color={colors.brand.primary}
            />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.subtitle}</Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={colors.icon.secondary}
            />
          </Pressable>
        ))}

        {POLICY_ROWS.map((row) => (
          <Pressable
            key={`web-${row.webPath}`}
            style={styles.row}
            onPress={() => void openWeb(row.webPath, row.route)}
          >
            <MaterialCommunityIcons
              name="open-in-new"
              size={22}
              color={colors.brand.primary}
            />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Open {row.title} in browser</Text>
              <Text style={styles.rowSub}>
                {webBase}
                {row.webPath}
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={colors.icon.secondary}
            />
          </Pressable>
        ))}

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>{APP_ENTERPRISE_NAME}</Text>
          <Text style={styles.contactLine}>UDYAM: {APP_UDYAM_NUMBER}</Text>
          <Text style={styles.contactLine}>{APP_BUSINESS_ADDRESS}</Text>
          <Pressable onPress={() => void Linking.openURL(`mailto:${APP_SUPPORT_EMAIL}`)}>
            <Text style={styles.contactLink}>{APP_SUPPORT_EMAIL}</Text>
          </Pressable>
          <Pressable onPress={() => void Linking.openURL(`tel:${APP_SUPPORT_PHONE_TEL}`)}>
            <Text style={styles.contactLink}>{APP_SUPPORT_PHONE}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 17,
    color: colors.text.heading,
  },
  content: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  brand: {
    fontFamily: fonts.poppins.bold,
    fontSize: 24,
    color: colors.text.heading,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.brand.accent,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  rowSub: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  contactCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    gap: spacing.xs,
  },
  contactTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.heading,
    marginBottom: spacing.xs,
  },
  contactLine: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text.secondary,
  },
  contactLink: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
    color: colors.brand.link,
    marginTop: spacing.xs,
  },
});
