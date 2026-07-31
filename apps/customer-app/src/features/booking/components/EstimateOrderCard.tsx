import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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

export type EstimateCounts = Record<string, number>;

export type EstimatedGarmentLine = {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  communityId: string | null;
  userId?: string | null;
  city?: string | null;
  counts: EstimateCounts;
  onChangeCounts: (next: EstimateCounts) => void;
};

function CounterRow({
  item,
  count,
  onAdjust,
  isLast,
}: {
  item: GarmentCatalogItem;
  count: number;
  onAdjust: (delta: number) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.counterRow, isLast && styles.counterRowLast]}>
      <View style={styles.counterLeft}>
        <MaterialCommunityIcons
          name={item.icon}
          size={20}
          color={colors.icon.secondary}
          style={styles.rowIcon}
        />
        <View style={styles.counterText}>
          <Text style={styles.rowName}>{item.name}</Text>
          <Text style={styles.rowPrice}>₹{item.unitPrice} each</Text>
        </View>
      </View>
      <View style={styles.counter}>
        <Pressable
          style={styles.counterBtn}
          onPress={() => onAdjust(-1)}
          disabled={count <= 0}
          hitSlop={8}
        >
          <MaterialCommunityIcons
            name="minus"
            size={18}
            color={count <= 0 ? colors.icon.inactive : colors.brand.primary}
          />
        </Pressable>
        <Text style={styles.counterValue}>{count}</Text>
        <Pressable style={styles.counterBtn} onPress={() => onAdjust(1)} hitSlop={8}>
          <MaterialCommunityIcons name="plus" size={18} color={colors.brand.primary} />
        </Pressable>
      </View>
    </View>
  );
}

export function EstimateOrderCard({
  communityId,
  userId,
  city,
  counts,
  onChangeCounts,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!communityId) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getGarmentCatalog({ communityId, userId, city }).then((items) => {
      if (!cancelled) {
        setCatalog(items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [communityId, userId, city]);

  const { primary, more } = useMemo(() => splitCatalog(catalog), [catalog]);

  const { totalQty, totalAmount } = useMemo(() => {
    let qty = 0;
    let amount = 0;
    for (const item of catalog) {
      const n = counts[item.serviceId] || 0;
      qty += n;
      amount += n * item.unitPrice;
    }
    return { totalQty: qty, totalAmount: amount };
  }, [catalog, counts]);

  const adjust = (serviceId: string, delta: number) => {
    const current = counts[serviceId] || 0;
    onChangeCounts({ ...counts, [serviceId]: Math.max(0, current + delta) });
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setShowMore(false);
  };

  const summaryLabel =
    totalQty > 0
      ? `${totalQty} garment${totalQty === 1 ? '' : 's'} • ₹${totalAmount}`
      : 'Add garments (optional)';

  const visibleItems = showMore ? [...primary, ...more] : primary;

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.summaryCard, totalQty > 0 && styles.summaryCardActive]}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
      >
        <View style={[styles.cardIconWrap, styles.estimateIcon]}>
          <MaterialCommunityIcons
            name="hanger"
            size={20}
            color={colors.status.info.foreground}
          />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Estimate Bill</Text>
          <Text
            style={[styles.cardSubtitle, totalQty > 0 && styles.cardSubtitleActive]}
            numberOfLines={1}
          >
            {summaryLabel}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="pencil-outline"
          size={18}
          color={colors.icon.secondary}
        />
      </Pressable>

      <Modal
        visible={sheetOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeSheet}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Estimate Bill</Text>
            <Pressable onPress={closeSheet} hitSlop={12}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetList}
          >
            {loading ? (
              <Text style={styles.loadingText}>Loading categories…</Text>
            ) : catalog.length === 0 ? (
              <Text style={styles.loadingText}>No garment categories available.</Text>
            ) : (
              <>
                {visibleItems.map((item, index) => (
                  <CounterRow
                    key={item.serviceId}
                    item={item}
                    count={counts[item.serviceId] || 0}
                    onAdjust={(delta) => adjust(item.serviceId, delta)}
                    isLast={
                      index === visibleItems.length - 1 &&
                      (showMore || more.length === 0)
                    }
                  />
                ))}

                {more.length > 0 && (
                  <Pressable
                    style={styles.moreRow}
                    onPress={() => setShowMore((v) => !v)}
                  >
                    <View style={styles.moreLeft}>
                      <MaterialCommunityIcons
                        name={showMore ? 'minus-circle-outline' : 'plus-circle-outline'}
                        size={20}
                        color={colors.brand.primary}
                      />
                      <Text style={styles.moreLabel}>
                        {showMore ? 'Show less' : 'More categories'}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={showMore ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.icon.secondary}
                    />
                  </Pressable>
                )}

                <View style={styles.infoBox}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={16}
                    color={colors.status.info.text}
                    style={styles.infoIcon}
                  />
                  <Text style={styles.infoText}>
                    Final count and amount are confirmed by the pickup executive.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.totalBar}>
            <View>
              <Text style={styles.totalLabel}>Estimated total</Text>
              <Text style={styles.totalQty}>
                {totalQty} garment{totalQty === 1 ? '' : 's'}
              </Text>
            </View>
            <Text style={styles.totalAmount}>₹{totalAmount}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function buildEstimateLines(
  catalog: GarmentCatalogItem[],
  counts: EstimateCounts,
): EstimatedGarmentLine[] {
  return catalog
    .map((item) => ({
      serviceId: item.serviceId,
      name: item.name,
      quantity: counts[item.serviceId] || 0,
      unitPrice: item.unitPrice,
    }))
    .filter((line) => line.quantity > 0);
}

export function estimateTotals(lines: EstimatedGarmentLine[]): {
  quantity: number;
  amount: number;
} {
  return lines.reduce(
    (acc, line) => ({
      quantity: acc.quantity + line.quantity,
      amount: acc.amount + line.quantity * line.unitPrice,
    }),
    { quantity: 0, amount: 0 },
  );
}

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  summaryCardActive: {
    borderColor: colors.brand.primary,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  estimateIcon: {
    backgroundColor: colors.status.info.background,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    marginRight: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  cardSubtitle: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  cardSubtitleActive: {
    color: colors.text.heading,
    fontFamily: fonts.inter.medium,
  },
  loadingText: {
    fontFamily: fonts.inter.regular,
    fontSize: 13,
    color: colors.text.muted,
    paddingVertical: spacing.md,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  counterRowLast: {
    borderBottomWidth: 0,
  },
  counterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  rowIcon: {
    marginRight: spacing.sm,
  },
  counterText: {
    flex: 1,
  },
  rowName: {
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.heading,
  },
  rowPrice: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    minWidth: 24,
    textAlign: 'center',
    fontFamily: fonts.inter.semibold,
    fontSize: 15,
    color: colors.text.heading,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  moreLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  moreLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 14,
    color: colors.brand.primary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.status.info.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.status.info.text,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surface.background,
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
  },
  sheetTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 18,
    color: colors.text.heading,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  totalBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
    backgroundColor: colors.surface.elevated,
  },
  totalLabel: {
    fontFamily: fonts.inter.medium,
    fontSize: 13,
    color: colors.text.secondary,
  },
  totalQty: {
    fontFamily: fonts.inter.regular,
    fontSize: 12,
    color: colors.text.muted,
    marginTop: 2,
  },
  totalAmount: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 22,
    color: colors.text.heading,
  },
});
