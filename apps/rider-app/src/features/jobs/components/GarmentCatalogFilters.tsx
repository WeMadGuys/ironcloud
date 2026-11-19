import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { serviceLineLabel, type ServiceLineId } from '@ironcloud/db';
import { colors, radius, spacing, typographyScale } from '@ironcloud/ui';

type Props = {
  serviceLines: ServiceLineId[];
  serviceLine: string;
  onServiceLineChange: (id: ServiceLineId) => void;
  query: string;
  onQueryChange: (value: string) => void;
  categories: string[];
  category: string;
  onCategoryChange: (category: string) => void;
};

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

export function GarmentCatalogFilters({
  serviceLines,
  serviceLine,
  onServiceLineChange,
  query,
  onQueryChange,
  categories,
  category,
  onCategoryChange,
}: Props) {
  const [open, setOpen] = useState(false);
  if (serviceLines.length === 0) return null;

  return (
    <View style={styles.root}>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        accessibilityState={{ expanded: open }}
        accessibilityRole="button"
        accessibilityLabel="Service type"
      >
        <Text style={styles.triggerLabel}>{serviceLineLabel(serviceLine)}</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.icon.secondary}
        />
      </Pressable>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          placeholder="Search a service"
          placeholderTextColor={colors.text.muted}
          style={[styles.search, query.length > 0 && styles.searchWithClear]}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search a service"
        />
        {query.length > 0 ? (
          <Pressable
            onPress={() => onQueryChange('')}
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
        {categories.map((tab) => {
          const selected = tab === category;
          return (
            <Pressable
              key={tab}
              onPress={() => onCategoryChange(tab)}
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

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={styles.backdropTap}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close service types"
          />
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Service type</Text>
            <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
              {serviceLines.map((id) => {
                const selected = id === serviceLine;
                return (
                  <Pressable
                    key={id}
                    style={[styles.option, selected && styles.optionSelected]}
                    onPress={() => {
                      onServiceLineChange(id);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {serviceLineLabel(id)}
                    </Text>
                    {selected ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color={colors.brand.primary}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  trigger: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  triggerLabel: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.heading,
  },
  searchWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  search: {
    width: '100%',
    minHeight: 44,
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
    paddingBottom: spacing.xs,
  },
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.elevated,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
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
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface.overlay,
  },
  backdropTap: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    zIndex: 1,
    maxHeight: '70%',
    borderRadius: radius.lg,
    backgroundColor: colors.surface.elevated,
    overflow: 'hidden',
  },
  menuTitle: {
    fontFamily: fonts.poppins.semibold,
    fontSize: 16,
    color: colors.text.heading,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.brand.accentMuted,
  },
  optionLabel: {
    flex: 1,
    fontFamily: fonts.inter.medium,
    fontSize: 15,
    color: colors.text.heading,
  },
  optionLabelSelected: {
    color: colors.brand.primary,
  },
});
