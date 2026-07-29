import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  shadows,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  getCachedReferral,
  getMyReferral,
  type ReferralListItem,
  type ReferralMeResponse,
} from '../../src/features/referrals/services/referral.service';

function statusLabel(status: string): string {
  if (status === 'rewarded') return 'Earned';
  if (status === 'pending') return 'Pending';
  if (status === 'expired') return 'Expired';
  return status;
}

function statusColor(status: string): string {
  if (status === 'rewarded') return colors.status.success.foreground;
  if (status === 'pending') return colors.brand.accent;
  return colors.text.muted;
}

export default function ReferralsScreen() {
  const router = useRouter();
  const [data, setData] = useState<ReferralMeResponse | null>(
    () => getCachedReferral(),
  );
  const [isLoading, setIsLoading] = useState(() => !getCachedReferral());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (opts?: { force?: boolean }) => {
    const hasCache = Boolean(getCachedReferral());
    if (hasCache && !opts?.force) {
      setIsRefreshing(true);
    } else if (!hasCache) {
      setIsLoading(true);
    }
    setError('');

    try {
      const next = await getMyReferral({ force: opts?.force });
      setData(next);
    } catch (err) {
      if (!getCachedReferral()) {
        setError(err instanceof Error ? err.message : 'Failed to load referrals');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Show cached data immediately; refresh in background.
      const cached = getCachedReferral();
      if (cached) setData(cached);
      load();
    }, [load]),
  );

  const handleCopy = async () => {
    if (!data?.code) return;
    await Clipboard.setStringAsync(data.code);
    Alert.alert('Copied', 'Referral code copied to clipboard.');
  };

  const handleShare = async () => {
    if (!data?.code) return;
    const message =
      data.program?.shareMessage ||
      `Use my IronCloud referral code ${data.code} when you sign up!`;
    try {
      await Share.share({ message });
    } catch {
      // User dismissed share sheet
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.icon.primary}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Refer & Earn</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading && !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : error && !data ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => load({ force: true })}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {isRefreshing ? (
            <View style={styles.refreshRow}>
              <ActivityIndicator size="small" color={colors.brand.primary} />
            </View>
          ) : null}
          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons
                name="gift-outline"
                size={28}
                color={colors.brand.onPrimary}
              />
            </View>
            <Text style={styles.heroTitle}>
              {data?.program?.name || 'Refer & Earn'}
            </Text>
            {data?.program ? (
              <>
                <Text style={styles.heroSubtitle}>
                  You get ₹{data.program.referrerReward} · Friend gets ₹
                  {data.program.refereeReward}
                </Text>
                <Text style={styles.heroCondition}>
                  Friend must recharge ₹{data.program.minTopup} or more (first
                  qualifying top-up)
                </Text>
              </>
            ) : (
              <Text style={styles.heroSubtitle}>
                No active referral program right now. Check back soon.
              </Text>
            )}
          </View>

          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Your referral code</Text>
            <Text style={styles.codeValue}>{data?.code || '—'}</Text>
            <View style={styles.codeActions}>
              <Pressable style={styles.secondaryBtn} onPress={handleCopy}>
                <MaterialCommunityIcons
                  name="content-copy"
                  size={18}
                  color={colors.brand.primary}
                />
                <Text style={styles.secondaryBtnText}>Copy</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={handleShare}>
                <MaterialCommunityIcons
                  name="share-variant"
                  size={18}
                  color={colors.brand.onPrimary}
                />
                <Text style={styles.primaryBtnText}>Share</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{data?.stats.totalReferred ?? 0}</Text>
              <Text style={styles.statLabel}>Referred</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{data?.stats.pending ?? 0}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ₹{data?.stats.earnedAmount ?? 0}
              </Text>
              <Text style={styles.statLabel}>Earned</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Your referrals</Text>
          {(data?.referrals?.length ?? 0) === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons
                name="account-multiple-outline"
                size={36}
                color={colors.text.muted}
              />
              <Text style={styles.emptyTitle}>No referrals yet</Text>
              <Text style={styles.emptySubtitle}>
                Share your code with friends to start earning.
              </Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {data!.referrals.map((item: ReferralListItem, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.listRow,
                    index === data!.referrals.length - 1 && styles.listRowLast,
                  ]}
                >
                  <View style={styles.listAvatar}>
                    <Text style={styles.listAvatarText}>
                      {item.friendName.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.listContent}>
                    <Text style={styles.listName}>{item.friendName}</Text>
                    <Text style={styles.listMeta}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.listRight}>
                    <Text
                      style={[
                        styles.listStatus,
                        { color: statusColor(item.status) },
                      ]}
                    >
                      {statusLabel(item.status)}
                    </Text>
                    {item.status === 'rewarded' ? (
                      <Text style={styles.listReward}>+₹{item.rewardAmount}</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  headerSpacer: {
    width: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  heroCard: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.md.native,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 20,
    color: colors.brand.onPrimary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.brand.onPrimary,
    textAlign: 'center',
    opacity: 0.95,
  },
  heroCondition: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.brand.onPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
    opacity: 0.85,
  },
  codeCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  codeLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  codeValue: {
    fontFamily: fonts.poppins.bold,
    fontSize: 28,
    color: colors.text.heading,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  codeActions: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: colors.surface.background,
  },
  secondaryBtnText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.primary,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brand.primary,
  },
  primaryBtnText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.onPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  statLabel: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginBottom: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  listCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  listAvatarText: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.brand.accent,
  },
  listContent: {
    flex: 1,
  },
  listName: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.primary,
  },
  listMeta: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  listRight: {
    alignItems: 'flex-end',
  },
  listStatus: {
    fontFamily: fonts.inter.semibold,
    fontSize: 13,
  },
  listReward: {
    fontFamily: fonts.inter.medium,
    fontSize: 12,
    color: colors.status.success.foreground,
    marginTop: 2,
  },
  errorText: {
    fontFamily: fonts.inter.regular,
    fontSize: 14,
    color: colors.status.error.foreground,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.brand.primary,
  },
  retryText: {
    fontFamily: fonts.inter.semibold,
    fontSize: 14,
    color: colors.brand.onPrimary,
  },
  refreshRow: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
});
