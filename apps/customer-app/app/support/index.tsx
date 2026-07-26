import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  categoryLabel,
  isTicketOpen,
  listTickets,
  type SupportTicketWithPreview,
} from '../../src/features/support/services/support.service';

type Filter = 'open' | 'resolved';

function formatTicketDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SupportListScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('open');
  const [tickets, setTickets] = useState<SupportTicketWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (activeFilter: Filter, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setTickets(await listTickets(activeFilter));
    } catch (err) {
      console.error('Error loading support tickets:', err);
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [filter, load]),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <Pressable
          style={styles.newButton}
          onPress={() => router.push('/support/new')}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="plus" size={22} color={colors.brand.primary} />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['open', 'resolved'] as Filter[]).map((tab) => {
          const active = filter === tab;
          return (
            <Pressable
              key={tab}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {tab === 'open' ? 'Open' : 'Resolved'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            tickets.length === 0 ? styles.emptyList : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(filter, true)}
              tintColor={colors.brand.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons
                name="headset"
                size={40}
                color={colors.icon.inactive}
              />
              <Text style={styles.emptyTitle}>
                {filter === 'open' ? 'No open requests' : 'No resolved requests'}
              </Text>
              <Text style={styles.emptyHint}>
                {filter === 'open'
                  ? 'Tap + to raise a new support request'
                  : 'Resolved requests will appear here'}
              </Text>
              {filter === 'open' && (
                <Pressable
                  style={styles.emptyCta}
                  onPress={() => router.push('/support/new')}
                >
                  <Text style={styles.emptyCtaText}>New request</Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/support/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.category}>{categoryLabel(item.category)}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isTicketOpen(item.status)
                      ? styles.statusOpen
                      : styles.statusResolved,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      isTicketOpen(item.status)
                        ? styles.statusTextOpen
                        : styles.statusTextResolved,
                    ]}
                  >
                    {isTicketOpen(item.status) ? 'Open' : 'Resolved'}
                  </Text>
                </View>
              </View>
              {item.preview ? (
                <Text style={styles.preview} numberOfLines={2}>
                  {item.preview}
                </Text>
              ) : null}
              <Text style={styles.date}>{formatTicketDate(item.created_at)}</Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  newButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.brand.primary,
  },
  tabText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.brand.onPrimary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyList: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['2xl'],
  },
  emptyTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginTop: spacing.md,
  },
  emptyHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyCta: {
    marginTop: spacing.lg,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  emptyCtaText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.onPrimary,
  },
  card: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  category: {
    flex: 1,
    fontFamily: fonts.poppins.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  statusOpen: {
    backgroundColor: colors.status.info.background,
  },
  statusResolved: {
    backgroundColor: colors.status.success.background,
  },
  statusText: {
    fontFamily: fonts.inter.medium,
    fontSize: 11,
  },
  statusTextOpen: {
    color: colors.status.info.text,
  },
  statusTextResolved: {
    color: colors.status.success.text,
  },
  preview: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  date: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
});
