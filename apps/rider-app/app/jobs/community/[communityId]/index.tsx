import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import { getTowerJobs } from '../../../../src/features/jobs/services/jobs.service';

function openCommunityMaps(communityName: string) {
  const query = encodeURIComponent(communityName);
  const url = Platform.select({
    ios: `maps:0,0?q=${query}`,
    android: `geo:0,0?q=${query}`,
    default: `https://www.google.com/maps/search/?api=1&query=${query}`,
  });
  if (url) Linking.openURL(url);
}

export default function CommunityTowersScreen() {
  const router = useRouter();
  const { communityId, day, communityName } = useLocalSearchParams<{
    communityId: string;
    day?: string;
    communityName?: string;
  }>();
  const dayOffset = Number(day ?? 0);
  const [loading, setLoading] = useState(true);
  const [towers, setTowers] = useState<
    { tower: string; totalJobs: number; completedJobs: number }[]
  >([]);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!communityId) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getTowerJobs(communityId, dayOffset);
      setTowers(data);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [communityId, dayOffset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const displayName = communityName || 'Community';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.title}>Select Tower / Block</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.communityBanner}>
        <View style={styles.communityBannerText}>
          <Text style={styles.communityName} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.communityHint}>Choose a tower to view flats</Text>
        </View>
        <Pressable
          style={styles.mapButton}
          onPress={() => openCommunityMaps(displayName)}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="map-marker-radius" size={22} color={colors.brand.accent} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {towers.map((tower) => (
            <Pressable
              key={tower.tower}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/jobs/community/[communityId]/[tower]',
                  params: {
                    communityId: communityId!,
                    tower: tower.tower,
                    day: String(dayOffset),
                    communityName: displayName,
                  },
                })
              }
            >
              <View style={styles.cardIcon}>
                <MaterialCommunityIcons name="office-building" size={22} color={colors.brand.accent} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>Tower {tower.tower}</Text>
                <Text style={styles.cardSub}>
                  {tower.completedJobs} / {tower.totalJobs} completed
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.icon.secondary} />
            </Pressable>
          ))}
          {towers.length === 0 && (
            <Text style={styles.empty}>No towers with jobs for this day.</Text>
          )}
        </ScrollView>
      )}
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
  title: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 17,
    color: colors.text.heading,
  },
  communityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  communityBannerText: { flex: 1, paddingRight: spacing.md },
  communityName: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
  },
  communityHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 4,
  },
  mapButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: { marginTop: spacing['2xl'] },
  list: { padding: spacing.lg, paddingTop: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontFamily: fonts.inter.semibold, fontSize: 15, color: colors.text.heading },
  cardSub: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.text.muted, marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: fonts.inter.regular, color: colors.text.muted, marginTop: spacing.xl },
});
