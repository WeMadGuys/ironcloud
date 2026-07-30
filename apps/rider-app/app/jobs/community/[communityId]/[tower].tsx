import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

import {
  getFlatJobs,
  type FlatJob,
} from '../../../../src/features/jobs/services/jobs.service';

function actionLabel(state: FlatJob['buttonState']) {
  switch (state) {
    case 'collect':
      return 'Collect';
    case 'deliver':
      return 'Deliver';
    case 'collected':
      return 'Collected';
    case 'delivered':
      return 'Delivered';
  }
}

export default function FlatListScreen() {
  const router = useRouter();
  const { communityId, tower, day } = useLocalSearchParams<{
    communityId: string;
    tower: string;
    day?: string;
  }>();
  const dayOffset = Number(day ?? 0);
  const [loading, setLoading] = useState(true);
  const [flats, setFlats] = useState<FlatJob[]>([]);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async () => {
    if (!communityId || !tower) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await getFlatJobs(
        communityId,
        decodeURIComponent(tower),
        dayOffset,
      );
      setFlats(data);
      hasLoadedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [communityId, tower, dayOffset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleAction = (flat: FlatJob) => {
    if (flat.buttonState === 'collected' || flat.buttonState === 'delivered') return;

    if (flat.buttonState === 'collect') {
      router.push({
        pathname: '/jobs/order/[orderId]/pickup',
        params: {
          orderId: flat.orderId,
          communityId: flat.communityId,
          flat: flat.flatNumber,
        },
      });
      return;
    }

    router.push({
      pathname: '/jobs/order/[orderId]/delivery',
      params: {
        orderId: flat.orderId,
        flat: flat.flatNumber,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.title}>Tower {decodeURIComponent(tower || '')}</Text>
        <View style={styles.back} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {flats.map((flat) => {
            const disabled = flat.buttonState === 'collected' || flat.buttonState === 'delivered';
            const isSuccess =
              flat.buttonState === 'collected' || flat.buttonState === 'delivered';
            return (
              <View key={`${flat.jobId}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.flatLabel}>Flat {flat.flatNumber}</Text>
                    <Text style={styles.orderId}>#{flat.orderNumber}</Text>
                    <Text style={styles.jobType}>
                      {flat.jobType === 'pickup' ? 'Pickup' : 'Delivery'}
                      {flat.garmentCount > 0 ? ` • ${flat.garmentCount} items` : ''}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.actionButton,
                      isSuccess && styles.actionButtonDone,
                      disabled && styles.actionButtonDisabled,
                    ]}
                    onPress={() => handleAction(flat)}
                    disabled={disabled}
                  >
                    <Text style={[styles.actionText, isSuccess && styles.actionTextDone]}>
                      {actionLabel(flat.buttonState)}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          {flats.length === 0 && (
            <Text style={styles.empty}>No flats with jobs in this tower.</Text>
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
  title: { flex: 1, textAlign: 'center', fontFamily: fonts.poppins.semibold, fontSize: 17, color: colors.text.heading },
  loader: { marginTop: spacing['2xl'] },
  list: { padding: spacing.lg, paddingBottom: spacing['2xl'] },
  card: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flatLabel: { fontFamily: fonts.inter.semibold, fontSize: 16, color: colors.text.heading },
  orderId: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.brand.accent, marginTop: 2 },
  jobType: { fontFamily: fonts.inter.regular, fontSize: 12, color: colors.text.muted, marginTop: 2 },
  actionButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actionButtonDone: {
    backgroundColor: colors.status.success.background,
    borderWidth: 1,
    borderColor: colors.status.success.foreground,
  },
  actionButtonDisabled: { opacity: 0.9 },
  actionText: { fontFamily: fonts.inter.semibold, fontSize: 13, color: colors.brand.onPrimary },
  actionTextDone: { color: colors.status.success.foreground },
  empty: { textAlign: 'center', fontFamily: fonts.inter.regular, color: colors.text.muted, marginTop: spacing.xl },
});
