import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, typographyScale } from '@ironcloud/ui';

import {
  getRiderActivation,
  isRiderAuthenticated,
} from '../../src/features/auth/services/auth';

const { fontFamily } = typographyScale;
const fonts = fontFamily.native;

type Gate = 'loading' | 'login' | 'pending' | 'ok';

export default function TabsLayout() {
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    (async () => {
      try {
        const authenticated = await isRiderAuthenticated();
        if (!authenticated) {
          setGate('login');
          return;
        }
        const { isActive } = await getRiderActivation();
        setGate(isActive ? 'ok' : 'pending');
      } catch {
        setGate('login');
      }
    })();
  }, []);

  if (gate === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  if (gate === 'login') {
    return <Redirect href="/(auth)/login" />;
  }

  if (gate === 'pending') {
    return <Redirect href="/(auth)/pending" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand.accent,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarStyle: { display: 'none' },
        tabBarLabelStyle: {
          fontFamily: fonts.inter.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="clipboard-list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface.background,
  },
});
