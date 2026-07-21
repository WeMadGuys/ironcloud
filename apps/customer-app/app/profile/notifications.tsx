import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
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
  formatActivityTime,
  getActivityFeed,
  getNotificationPrefs,
  saveNotificationPrefs,
  type ActivityItem,
  type NotificationPrefs,
} from '../../src/features/notifications/services/notifications.service';

function activityIcon(status: string): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (status) {
    case 'booked':
    case 'pickup_assigned':
      return 'calendar-clock';
    case 'pickup_in_progress':
      return 'motorbike';
    case 'picked_up':
      return 'package-variant';
    case 'ironing':
      return 'iron';
    case 'out_for_delivery':
      return 'truck-delivery-outline';
    case 'delivered':
    case 'completed':
      return 'check-circle-outline';
    default:
      return 'bell-outline';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [feed, notificationPrefs] = await Promise.all([
        getActivityFeed(),
        getNotificationPrefs(),
      ]);
      setActivities(feed);
      setPrefs(notificationPrefs);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const updatePref = async <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) => {
    if (!prefs) return;

    let next: NotificationPrefs = { ...prefs, [key]: value };

    // Master push toggle turns order updates off/on together for clarity.
    if (key === 'pushEnabled') {
      next = {
        ...next,
        orderUpdates: value as boolean,
      };
    }

    setPrefs(next);
    await saveNotificationPrefs(next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading || !prefs ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefsCard}>
            <PrefRow
              icon="bell-ring-outline"
              label="Push notifications"
              subtitle="Enable all push alerts"
              value={prefs.pushEnabled}
              onValueChange={(value) => updatePref('pushEnabled', value)}
            />
            <PrefRow
              icon="package-variant-closed"
              label="Order updates"
              subtitle="Pickup, ironing, and delivery status"
              value={prefs.orderUpdates && prefs.pushEnabled}
              onValueChange={(value) => updatePref('orderUpdates', value)}
              disabled={!prefs.pushEnabled}
            />
            <PrefRow
              icon="tag-outline"
              label="Offers & promotions"
              subtitle="Deals and wallet cashback alerts"
              value={prefs.promotions && prefs.pushEnabled}
              onValueChange={(value) => updatePref('promotions', value)}
              disabled={!prefs.pushEnabled}
            />
            <PrefRow
              icon="message-text-outline"
              label="SMS alerts"
              subtitle="Important updates via SMS"
              value={prefs.smsEnabled}
              onValueChange={(value) => updatePref('smsEnabled', value)}
              isLast
            />
          </View>

          <Text style={styles.sectionTitle}>Activity</Text>
          {activities.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <MaterialCommunityIcons
                  name="history"
                  size={32}
                  color={colors.brand.accent}
                />
              </View>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptySubtitle}>
                Pickup scheduled, delivery updates, and other order events will show here.
              </Text>
            </View>
          ) : (
            <View style={styles.activityCard}>
              {activities.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.activityItem,
                    index === activities.length - 1 && styles.activityItemLast,
                  ]}
                >
                  <View style={styles.activityIconWrap}>
                    <MaterialCommunityIcons
                      name={activityIcon(item.status)}
                      size={20}
                      color={colors.brand.accent}
                    />
                  </View>
                  <View style={styles.activityBody}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityDescription}>{item.description}</Text>
                    <Text style={styles.activityMeta}>
                      {item.orderNumber ? `${item.orderNumber} • ` : ''}
                      {formatActivityTime(item.createdAt)}
                    </Text>
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

function PrefRow({
  icon,
  label,
  subtitle,
  value,
  onValueChange,
  disabled,
  isLast,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.prefRow, isLast && styles.prefRowLast, disabled && styles.prefDisabled]}>
      <View style={styles.prefIconWrap}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.icon.secondary} />
      </View>
      <View style={styles.prefContent}>
        <Text style={styles.prefLabel}>{label}</Text>
        <Text style={styles.prefSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border.default,
          true: colors.brand.accent,
        }}
        thumbColor={colors.surface.elevated}
      />
    </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  prefsCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  prefRowLast: {
    borderBottomWidth: 0,
  },
  prefDisabled: {
    opacity: 0.5,
  },
  prefIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  prefContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  prefLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.primary,
  },
  prefSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  activityCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
    ...shadows.sm.native,
  },
  activityItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  activityItemLast: {
    borderBottomWidth: 0,
  },
  activityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  activityBody: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  activityDescription: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  activityMeta: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
