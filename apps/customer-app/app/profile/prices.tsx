import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  colors,
  radius,
  spacing,
  typographyScale,
} from '@ironcloud/ui';

import { GarmentRateList } from '../../src/features/booking/components/GarmentRateList';
import {
  getCachedCustomerAddress,
  listAddresses,
  type CustomerAddress,
} from '../../src/features/profile/services/address.service';
import { supabase } from '../../src/lib/supabase';

export default function PricesScreen() {
  const router = useRouter();
  const [address, setAddress] = useState<CustomerAddress | null>(
    () => getCachedCustomerAddress(),
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    try {
      const [addresses, session] = await Promise.all([
        listAddresses(),
        supabase.auth.getSession(),
      ]);
      setAddress(addresses.find((item) => item.isDefault) ?? addresses[0] ?? null);
      setUserId(session.data.session?.user?.id ?? null);
    } catch (error) {
      console.error('[Prices] load error:', error);
      setAddress(getCachedCustomerAddress());
    } finally {
      setReady(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface.background} />

      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.icon.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Prices</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!ready ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <GarmentRateList
          communityId={address?.communityId ?? null}
          userId={userId}
          city={address?.city ?? null}
        />
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
  },
});
