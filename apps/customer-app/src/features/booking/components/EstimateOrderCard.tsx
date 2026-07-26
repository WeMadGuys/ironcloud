import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
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

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type EstimateCounts = Record<string, number>;

export type EstimatedGarmentLine = {
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type Props = {
  communityId: string | null;
  counts: EstimateCounts;
  onChangeCounts: (next: EstimateCounts) => void;
};

function animateExpand() {
  LayoutAnimation.configureNext({
    duration: 280,
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
}

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
  counts,
  onChangeCounts,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [catalog, setCatalog] = useState<GarmentCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!communityId) {
      setCatalog([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getGarmentCatalog(communityId).then((items) => {
      if (!cancelled) {
        setCatalog(items);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [communityId]);

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

  const toggleExpanded = () => {
    animateExpand();
    setExpanded((v) => !v);
  };

  const summaryLabel =
    totalQty > 0
      ? `${totalQty} garment${totalQty === 1 ? '' : 's'} • ₹${totalAmount}`
      : 'Add garments (optional)';

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.summaryCard, expanded && styles.summaryCardExpanded]}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
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

      {expanded && (
        <View style={styles.expandedCard}>
          {loading ? (
            <Text style={styles.loadingText}>Loading categories…</Text>
          ) : catalog.length === 0 ? (
            <Text style={styles.loadingText}>No garment categories available.</Text>
          ) : (
            <>
              {primary.map((item, index) => (
                <CounterRow
                  key={item.serviceId}
                  item={item}
                  count={counts[item.serviceId] || 0}
                  onAdjust={(delta) => adjust(item.serviceId, delta)}
                  isLast={index === primary.length - 1 && more.length === 0}
                />
              ))}

              {more.length > 0 && (
                <Pressable style={styles.moreRow} onPress={() => setMoreOpen(true)}>
                  <View style={styles.moreLeft}>
                    <MaterialCommunityIcons
                      name="plus-circle-outline"
                      size={20}
                      color={colors.brand.primary}
                    />
                    <Text style={styles.moreLabel}>More categories</Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
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
        </View>
      )}

      <Modal
        visible={moreOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setMoreOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>More categories</Text>
            <Pressable onPress={() => setMoreOpen(false)} hitSlop={12}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetList}>
            {more.map((item, index) => (
              <CounterRow
                key={item.serviceId}
                item={item}
                count={counts[item.serviceId] || 0}
                onAdjust={(delta) => adjust(item.serviceId, delta)}
                isLast={index === more.length - 1}
              />
            ))}
          </ScrollView>
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
  summaryCardExpanded: {
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
  expandedCard: {
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
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
  sheetList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
