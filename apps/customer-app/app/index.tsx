import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@ironcloud/ui';

import { supabase } from '../src/lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

type Destination = 'login' | 'home' | null;

export default function IndexScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [destination, setDestination] = useState<Destination>(null);

  useEffect(() => {
    resolveDestination();
  }, []);

  async function resolveDestination() {
    try {
      const userId = IS_MOCK_AUTH
        ? MOCK_USER_ID
        : (await supabase.auth.getUser()).data.user?.id || null;

      if (!userId) {
        setDestination('login');
        return;
      }

      const { data: addresses } = await (supabase
        .from('addresses') as ReturnType<typeof supabase.from>)
        .select('id')
        .eq('customer_id', userId)
        .limit(1);

      setDestination(addresses && addresses.length > 0 ? 'home' : 'login');
    } catch (error) {
      console.error('[Navigation] Error resolving destination:', error);
      setDestination('login');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !destination) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (destination === 'home') {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.background,
  },
});
