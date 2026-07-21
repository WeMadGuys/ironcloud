import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@ironcloud/ui';

import { isRiderAuthenticated } from '../src/features/auth/services/auth';

type Destination = 'login' | 'home' | null;

export default function Index() {
  const [destination, setDestination] = useState<Destination>(null);

  useEffect(() => {
    (async () => {
      try {
        const authenticated = await isRiderAuthenticated();
        setDestination(authenticated ? 'home' : 'login');
      } catch {
        setDestination('login');
      }
    })();
  }, []);

  if (!destination) {
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
