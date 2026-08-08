import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_LEGAL_NAME } from '@ironcloud/config/legal';
import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

type PolicyRow = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  route: '/profile/privacy' | '/profile/terms' | '/profile/refund' | '/profile/shipping';
};

const POLICY_ROWS: PolicyRow[] = [
  {
    title: 'Privacy Policy',
    subtitle: 'How we collect and use your data',
    icon: 'shield-account-outline',
    route: '/profile/privacy',
  },
  {
    title: 'Terms of Service',
    subtitle: `Rules for using ${APP_LEGAL_NAME}`,
    icon: 'file-document-outline',
    route: '/profile/terms',
  },
  {
    title: 'Cancellation & Refund Policy',
    subtitle: 'Cancellations, refunds, and timelines',
    icon: 'cash-refund',
    route: '/profile/refund',
  },
  {
    title: 'Shipping & Delivery Policy',
    subtitle: 'Pickup and return delivery turnaround',
    icon: 'truck-delivery-outline',
    route: '/profile/shipping',
  },
];

export default function AboutScreen() {
  const router = useRouter();

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
});
