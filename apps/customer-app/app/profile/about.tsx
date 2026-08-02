import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  APP_LEGAL_NAME,
  APP_SUPPORT_EMAIL,
} from '@ironcloud/config/legal';
import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import { getApiBaseUrl } from '../../src/lib/api';

export default function AboutScreen() {
  const router = useRouter();
  const webBase = getApiBaseUrl();

  const openWeb = async (path: string) => {
    const url = `${webBase}${path}`;
    try {
      await Linking.openURL(url);
    } catch {
      // Fall back to in-app document if browser cannot open.
      if (path.includes('privacy')) router.push('/profile/privacy');
      else router.push('/profile/terms');
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

        <Pressable
          style={styles.row}
          onPress={() => router.push('/profile/privacy')}
        >
          <MaterialCommunityIcons
            name="shield-account-outline"
            size={22}
            color={colors.brand.primary}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Privacy Policy</Text>
            <Text style={styles.rowSub}>How we collect and use your data</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.icon.secondary}
          />
        </Pressable>

        <Pressable style={styles.row} onPress={() => router.push('/profile/terms')}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={22}
            color={colors.brand.primary}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Terms of Service</Text>
            <Text style={styles.rowSub}>Rules for using {APP_LEGAL_NAME}</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.icon.secondary}
          />
        </Pressable>

        <Pressable style={styles.row} onPress={() => void openWeb('/privacy')}>
          <MaterialCommunityIcons
            name="open-in-new"
            size={22}
            color={colors.brand.primary}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Open Privacy Policy in browser</Text>
            <Text style={styles.rowSub}>{webBase}/privacy</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.icon.secondary}
          />
        </Pressable>

        <Pressable style={styles.row} onPress={() => void openWeb('/terms')}>
          <MaterialCommunityIcons
            name="open-in-new"
            size={22}
            color={colors.brand.primary}
          />
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Open Terms in browser</Text>
            <Text style={styles.rowSub}>{webBase}/terms</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color={colors.icon.secondary}
          />
        </Pressable>

        <Text style={styles.support}>Support: {APP_SUPPORT_EMAIL}</Text>
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
  support: {
    marginTop: spacing.lg,
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
  },
});
