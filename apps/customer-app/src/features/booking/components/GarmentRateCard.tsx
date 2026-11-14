import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { GarmentRateList } from './GarmentRateList';

type Props = {
  communityId: string | null;
  userId?: string | null;
  city?: string | null;
};

/**
 * Header icon + full garment rate card page (sheet).
 */
export function GarmentRateCard({ communityId, userId, city }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
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
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Rates</Text>
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={12}
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={colors.icon.primary}
              />
            </Pressable>
          </View>
          {open ? (
            <GarmentRateList communityId={communityId} userId={userId} city={city} />
          ) : null}
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
});
