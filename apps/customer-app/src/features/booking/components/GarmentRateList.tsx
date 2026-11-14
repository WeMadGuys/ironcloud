import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { isWeightService, listGarmentCategoryTabs } from '@ironcloud/db';
import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  getGarmentCatalog,
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
 * Searchable category price list. Used by the Home rates sheet and Profile → Prices.
 */
export function GarmentRateList({ communityId, userId, city }: Props) {
  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [loading, setLoading] = useState(Boolean(communityId));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!communityId) {
        setCatalog([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const next = await getGarmentCatalog({ communityId, userId, city });
        if (!cancelled) setCatalog(next);
      } catch (error) {
        console.error('[GarmentRateList] catalog error:', error);
        if (!cancelled) setCatalog([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [city, communityId, userId]);

  const categoryTabs = useMemo(
    () => listGarmentCategoryTabs(
      catalog.map((item) => item.garmentCategory),
      false,
    ),
    [catalog],
  );

  useEffect(() => {
    if (category !== 'All' && !categoryTabs.includes(category)) {
      setCategory('All');
    }
  }, [category, categoryTabs]);

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (category !== 'All' && item.garmentCategory !== category) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [catalog, category, query]);

  const showFilters = Boolean(communityId) && !loading && catalog.length > 0;

  return (
    <View style={styles.root}>
      {showFilters ? (
        <View style={styles.filters}>
          <View style={styles.searchWrap}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a service"
              placeholderTextColor={colors.text.muted}
              style={[styles.search, query.length > 0 && styles.searchWithClear]}
              autoCorrect={false}
              autoCapitalize="none"
              accessibilityLabel="Search a service"
            />
            {query.length > 0 ? (
              <Pressable
                onPress={() => setQuery('')}
                style={styles.searchClear}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={colors.icon.secondary}
                />
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}
          >
            {categoryTabs.map((tab) => {
              const selected = tab === category;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setCategory(tab)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {tab}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                name={catalog.length === 0 ? 'tag-outline' : 'magnify'}
                size={28}
                color={colors.icon.secondary}
              />
            </View>
            <Text style={styles.emptyTitle}>
              {catalog.length === 0 ? 'Rates unavailable' : 'No matching service'}
            </Text>
            <Text style={styles.emptyHint}>
              {catalog.length === 0
                ? 'Garment rates are not configured yet. Please check back soon.'
                : 'Try another name or category.'}
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
    </View>
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  search: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
    color: colors.text.heading,
    fontFamily: fonts.inter.regular,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchWithClear: {
    paddingRight: 40,
  },
  searchClear: {
    position: 'absolute',
    right: spacing.sm,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 28,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.brand.primary,
    borderColor: colors.brand.primary,
  },
  chipLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.heading,
  },
  chipLabelSelected: {
    color: colors.brand.onPrimary,
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
