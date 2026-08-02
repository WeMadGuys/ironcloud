import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typographyScale } from '@ironcloud/ui';
import type { LegalSection } from '@ironcloud/config/legal';

type Props = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export function LegalDocumentScreen({ title, lastUpdated, sections }: Props) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>Last updated: {lastUpdated}</Text>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
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
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 17,
    color: colors.text.heading,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  meta: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: spacing.xl,
  },
  section: { marginBottom: spacing.xl },
  heading: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text.secondary,
  },
});
