import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  inputs,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  getCachedRiderJobs,
  getHomeBundle,
  type CommunityJobSummary,
} from '../../src/features/jobs/services/jobs.service';

function getNextDays(count: number) {
  const days: { day: string; date: number; isToday: boolean }[] = [];
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({ day: names[d.getDay()], date: d.getDate(), isToday: i === 0 });
  }
  return days;
}

function CommunityCard({ item, onPress }: { item: CommunityJobSummary; onPress: () => void }) {
  const progress = item.totalJobs > 0 ? item.completedJobs / item.totalJobs : 0;
  const statusColor =
    item.status === 'active'
      ? colors.status.success.foreground
      : item.status === 'in_progress'
      ? colors.status.warning.foreground
      : colors.text.muted;

  return (
    <Pressable style={styles.communityCard} onPress={onPress}>
      <View style={styles.communityIcon}>
        <MaterialCommunityIcons name="office-building" size={22} color={colors.brand.accent} />
      </View>
      <View style={styles.communityBody}>
        <View style={styles.communityTop}>
          <Text style={styles.communityName} numberOfLines={1}>
            {item.communityName}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === 'active'
                ? 'Active'
                : item.status === 'in_progress'
                ? 'In Progress'
                : 'Upcoming'}
            </Text>
          </View>
        </View>
        <Text style={styles.communitySub}>{item.towersLabel}</Text>
        <Text style={styles.communityJobs}>{item.totalJobs} Jobs</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>
            {item.completedJobs} / {item.totalJobs} Completed
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.icon.secondary} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const days = getNextDays(7);
  const [selectedDay, setSelectedDay] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [initialLoading, setInitialLoading] = useState(() => !getCachedRiderJobs());
  const [contentLoading, setContentLoading] = useState(false);
  const hasLoadedOnceRef = useRef(Boolean(getCachedRiderJobs()));
  const [profileName, setProfileName] = useState('Rider');
  const [summary, setSummary] = useState({
    pickupOrders: 0,
    deliveryOrders: 0,
    totalGarments: 0,
    communities: 0,
    pendingJobs: 0,
    jobDayOffsets: [] as number[],
  });
  const [allCommunities, setAllCommunities] = useState<CommunityJobSummary[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const visibleCommunities = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return allCommunities;
    return allCommunities.filter(
      (c) =>
        c.communityName.toLowerCase().includes(q) ||
        c.towersLabel.toLowerCase().includes(q),
    );
  }, [allCommunities, debouncedSearch]);

  const loadData = useCallback(
    async (dayOffset: number, mode: 'initial' | 'content' = 'content') => {
      const warm = Boolean(getCachedRiderJobs()) || hasLoadedOnceRef.current;
      if (mode === 'initial' && !warm) {
        setInitialLoading(true);
      } else if (!warm) {
        setContentLoading(true);
      }

      try {
        const bundle = await getHomeBundle(dayOffset, '');
        if (bundle.profile) setProfileName(bundle.profile.fullName.split(' ')[0]);
        setSummary(bundle.summary);
        setAllCommunities(bundle.communities);
        hasLoadedOnceRef.current = true;
      } finally {
        setInitialLoading(false);
        setContentLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(selectedDay, initialLoading ? 'initial' : 'content');
      // initialLoading intentionally omitted — only gates first load mode.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadData, selectedDay]),
  );

  const handleSelectDay = (index: number) => {
    if (index === selectedDay || contentLoading) return;
    setSelectedDay(index);
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.fullLoader}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topSection}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              {greeting}, {profileName}
            </Text>
            <Text style={styles.greetingSub}>Ready to get things pressed.</Text>
          </View>
          <Pressable
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={8}
          >
            <Text style={styles.avatarText}>{profileName[0]}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateStrip}
        >
          {days.map((day, index) => {
            const selected = selectedDay === index;
            const hasJobs = summary.jobDayOffsets.includes(index);
            return (
              <Pressable
                key={index}
                style={styles.dayItem}
                onPress={() => handleSelectDay(index)}
              >
                <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>
                  {day.isToday ? 'Today' : day.day}
                </Text>
                <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                  <Text style={[styles.dayDate, selected && styles.dayDateSelected]}>
                    {String(day.date).padStart(2, '0')}
                  </Text>
                </View>
                {hasJobs && !selected && <View style={styles.dayDot} />}
                {selected && <View style={styles.dayUnderline} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {contentLoading ? (
          <View style={styles.contentLoader}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Today&apos;s Summary</Text>
              </View>
              <View style={styles.summaryRow}>
                <SummaryItem icon="shopping-outline" label="Pickup Orders" value={summary.pickupOrders} color={colors.brand.accent} />
                <SummaryItem icon="truck-delivery-outline" label="Delivery Orders" value={summary.deliveryOrders} color={colors.status.success.foreground} />
                <SummaryItem icon="tshirt-crew-outline" label="Total Garments" value={summary.totalGarments} color={colors.status.warning.foreground} />
                <SummaryItem icon="office-building-outline" label="Communities" value={summary.communities} color="#7C3AED" />
              </View>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.icon.secondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search apartment, tower or flat"
                  placeholderTextColor={inputs.placeholder.color}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>

            {visibleCommunities.length === 0 ? (
              <Text style={styles.empty}>No jobs for this day.</Text>
            ) : (
              visibleCommunities.map((item) => (
                <CommunityCard
                  key={item.communityId}
                  item={item}
                  onPress={() =>
                    router.push({
                      pathname: '/jobs/community/[communityId]',
                      params: {
                        communityId: item.communityId,
                        day: String(selectedDay),
                        communityName: item.communityName,
                      },
                    })
                  }
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}18` }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryItemLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { paddingBottom: spacing['2xl'], flexGrow: 1 },
  fullLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentLoader: {
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
  },
  topSection: {
    backgroundColor: colors.calendar.todayBackground,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  greeting: { fontFamily: fonts.poppins.bold, fontSize: 20, color: colors.text.heading },
  greetingSub: { fontFamily: fonts.inter.regular, fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  notifWrap: { padding: spacing.xs },
  notifBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.status.error.foreground,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadgeText: { fontFamily: fonts.inter.bold, fontSize: 9, color: colors.brand.onPrimary },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.poppins.bold, fontSize: 16, color: colors.brand.onPrimary },
  dateStrip: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  dayItem: { alignItems: 'center', marginRight: spacing.lg },
  dayLabel: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.text.muted, marginBottom: spacing.xs },
  dayLabelSelected: { color: colors.text.heading },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.elevated,
  },
  dayCircleSelected: { backgroundColor: colors.brand.primary },
  dayDate: { fontFamily: fonts.poppins.semibold, fontSize: 15, color: colors.text.primary },
  dayDateSelected: { color: colors.brand.onPrimary },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success.foreground,
    marginTop: spacing.xs,
  },
  dayUnderline: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.brand.accent,
    marginTop: spacing.xs,
  },
  summaryCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
    ...shadows.md.native,
  },
  summaryHeader: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: spacing.lg },
  summaryTitle: { fontFamily: fonts.poppins.semibold, fontSize: 17, color: colors.text.heading },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  summaryValue: { fontFamily: fonts.poppins.bold, fontSize: 22, color: colors.text.heading },
  summaryItemLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 10,
    color: colors.text.muted,
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  filterIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterStrip: { paddingLeft: spacing.lg, marginBottom: spacing.md },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
    marginRight: spacing.sm,
  },
  filterPillActive: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  filterText: { fontFamily: fonts.inter.medium, fontSize: 12, color: colors.text.secondary },
  filterTextActive: { color: colors.brand.onPrimary },
  communityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    ...shadows.sm.native,
  },
  communityIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  communityBody: { flex: 1 },
  communityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  communityName: { flex: 1, fontFamily: fonts.inter.semibold, fontSize: 15, color: colors.text.heading },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: fonts.inter.medium, fontSize: 10 },
  communitySub: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.text.muted, marginTop: 2 },
  communityJobs: { fontFamily: fonts.inter.semibold, fontSize: 13, color: colors.text.secondary, marginTop: spacing.xs },
  progressRow: { marginTop: spacing.sm },
  progressTrack: {
    height: 4,
    backgroundColor: colors.border.divider,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', backgroundColor: colors.brand.accent },
  progressLabel: { fontFamily: fonts.inter.regular, fontSize: 11, color: colors.text.muted },
  loader: { marginVertical: spacing.xl },
  empty: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
});
