import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  filterCatalogItems,
  isWeightService,
  resolveCatalogBrowse,
  type ServiceLineId,
} from '@ironcloud/db';
import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import {
  fetchGarmentCategoryOrder,
  getGarmentCatalog,
  type GarmentCatalogItem,
} from '../services/catalog.service';
import { GarmentCatalogFilters } from './GarmentCatalogFilters';
import { PriceQuote } from './PriceQuote';
import { ReadyIn } from './ReadyIn';

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
        <View style={styles.rateCopy}>
          <Text style={styles.rateName} numberOfLines={1}>
            {item.name}
          </Text>
          <ReadyIn days={item.estimatedDays} />
        </View>
      </View>
      <View style={styles.rateRight}>
        <PriceQuote
          price={item.unitPrice}
          listPrice={item.listPrice}
          unit={isWeightService(item) ? '/ kg' : '/ pc'}
        />
      </View>
    </View>
  );
}

/**
 * Searchable category price list. Used by the Home rates sheet and Profile → Prices.
 */
export function GarmentRateList({ communityId, userId, city }: Props) {
  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(communityId));
  const [query, setQuery] = useState('');
  const [serviceLine, setServiceLine] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!communityId) {
        setCatalog([]);
        setCategoryOrder([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [next, order] = await Promise.all([
          getGarmentCatalog({ communityId, userId, city }),
          fetchGarmentCategoryOrder(),
        ]);
        // No matching price means the service is not offered here. ₹0 is not a rate.
        const priced = next.filter((item) => item.unitPrice > 0);
        if (!cancelled) {
          setCatalog(priced);
          setCategoryOrder(order);
        }
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

  const browse = useMemo(
    () =>
      resolveCatalogBrowse(
        catalog,
        { serviceLine, garmentCategory: category },
        { savedOrder: categoryOrder },
      ),
    [catalog, category, categoryOrder, serviceLine],
  );

  useEffect(() => {
    if (browse.serviceLine && browse.serviceLine !== serviceLine) {
      setServiceLine(browse.serviceLine);
    }
    if (browse.garmentCategory && browse.garmentCategory !== category) {
      setCategory(browse.garmentCategory);
    }
  }, [browse.garmentCategory, browse.serviceLine, category, serviceLine]);

  const items = useMemo(() => {
    if (!browse.serviceLine || !browse.garmentCategory) return [];
    return filterCatalogItems(catalog, {
      serviceLine: browse.serviceLine,
      garmentCategory: browse.garmentCategory,
      query,
    });
  }, [browse.garmentCategory, browse.serviceLine, catalog, query]);

  const showFilters = Boolean(communityId) && !loading && catalog.length > 0;

  return (
    <View style={styles.root}>
      {showFilters ? (
        <View style={styles.filters}>
          <GarmentCatalogFilters
            serviceLines={browse.serviceLines}
            serviceLine={browse.serviceLine ?? ''}
            onServiceLineChange={(id: ServiceLineId) => setServiceLine(id)}
            query={query}
            onQueryChange={setQuery}
            categories={browse.categories}
            category={browse.garmentCategory ?? ''}
            onCategoryChange={setCategory}
          />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
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
  rateCopy: {
    flex: 1,
    minWidth: 0,
  },
  rateName: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.heading,
  },
  rateRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
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
