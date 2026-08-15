import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isWeightService } from '@ironcloud/db';
import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  getGarmentCatalog,
  splitCatalog,
  type GarmentCatalogItem,
} from '../services/catalog.service';

type Props = {
  communityId: string | null;
  userId?: string | null;
  city?: string | null;
};

function RateRow({
  item,
  isLast,
  zebra,
}: {
  item: GarmentCatalogItem;
  isLast?: boolean;
  zebra?: boolean;
}) {
  return (
    <View
      style={[
        styles.rateRow,
        zebra && styles.rateRowZebra,
        isLast && styles.rateRowLast,
      ]}
    >
      <View style={styles.rateLeft}>
        <View style={styles.rateIconWrap}>
          <MaterialCommunityIcons
            name={item.icon}
            size={20}
            color={colors.brand.primary}
          />
        </View>
        <Text style={styles.rateName} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      <View style={styles.rateRight}>
        <Text style={styles.ratePrice}>
          <Text style={styles.rateCurrency}>₹</Text>
          {item.unitPrice}
        </Text>
        <Text style={styles.rateUnit}>
          {isWeightService(item) ? '/ kg' : '/ pc'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Header icon + full garment rate card page (sheet).
 */
export function GarmentRateCard({ communityId, userId, city }: Props) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const catalogKey = `${communityId ?? ''}|${userId ?? ''}|${city ?? ''}`;

  const items = useMemo(() => {
    const { primary, more } = splitCatalog(catalog);
    return [...primary, ...more];
  }, [catalog]);

  const loadCatalog = useCallback(async () => {
    if (!communityId) {
      setCatalog([]);
      setLoadedKey(catalogKey);
      return;
    }
    if (loadedKey === catalogKey) return;

    setLoading(true);
    try {
      const next = await getGarmentCatalog({ communityId, userId, city });
      setCatalog(next);
      setLoadedKey(catalogKey);
    } catch (error) {
      console.error('[GarmentRateCard] catalog error:', error);
      setCatalog([]);
      setLoadedKey(catalogKey);
    } finally {
      setLoading(false);
    }
  }, [catalogKey, city, communityId, loadedKey, userId]);

  const openSheet = () => {
    setOpen(true);
    void loadCatalog();
  };

  const closeSheet = () => setOpen(false);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel="Garment rates"
      >
        <MaterialCommunityIcons
          name="tag-outline"
          size={20}
          color={colors.brand.primary}
        />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rates</Text>
            <Pressable onPress={closeSheet} hitSlop={12} accessibilityLabel="Close">
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {!communityId ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons
                    name="map-marker-outline"
                    size={28}
                    color={colors.icon.secondary}
                  />
                </View>
                <Text style={styles.emptyTitle}>Add your community</Text>
                <Text style={styles.emptyHint}>
                  Complete your address to see rates for your area.
                </Text>
              </View>
            ) : loading ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color={colors.brand.primary} />
                <Text style={styles.loadingText}>Loading rates…</Text>
              </View>
            ) : items.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <MaterialCommunityIcons
                    name="tag-outline"
                    size={28}
                    color={colors.icon.secondary}
                  />
                </View>
                <Text style={styles.emptyTitle}>Rates unavailable</Text>
                <Text style={styles.emptyHint}>
                  Garment rates are not configured yet. Please check back soon.
                </Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderLabel}>Garment</Text>
                  <Text style={styles.listHeaderLabel}>Rate</Text>
                </View>
                {items.map((item, index) => (
                  <RateRow
                    key={item.serviceId}
                    item={item}
                    zebra={index % 2 === 1}
                    isLast={index === items.length - 1}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  trigger: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    marginRight: spacing.xs,
  },
  page: {
    flex: 1,
    backgroundColor: colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  headerTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  listCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand.accentMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  listHeaderLabel: {
    fontFamily: fonts.inter.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.brand.primary,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
    backgroundColor: colors.surface.elevated,
  },
  rateRowZebra: {
    backgroundColor: colors.surface.background,
  },
  rateRowLast: {
    borderBottomWidth: 0,
  },
  rateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
    minWidth: 0,
  },
  rateIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.brand.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rateName: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.heading,
  },
  rateRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  ratePrice: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  rateCurrency: {
    fontFamily: fonts.inter.bold,
  },
  rateUnit: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.md,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
