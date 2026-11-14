import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { supabase } from '../src/lib/supabase';
import {
  extractNotificationPath,
  listenForNewOrderBookings,
  listenForPickupPushes,
  registerRiderPush,
} from '../src/features/notifications/services/push.service';

SplashScreen.preventAutoHideAsync();

function sessionAccessToken(session: unknown): string | null {
  if (!session || typeof session !== 'object') return null;
  const token = (session as { access_token?: unknown }).access_token;
  return typeof token === 'string' && token.trim() ? token : null;
}

export default function RootLayout() {
  const router = useRouter();
  const responseSub = useRef<{ remove: () => void } | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
    'Poppins-ExtraBold': Poppins_800ExtraBold,
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== 'SIGNED_IN' &&
        event !== 'TOKEN_REFRESHED' &&
        event !== 'INITIAL_SESSION'
      ) {
        return;
      }
      const accessToken = sessionAccessToken(session);
      if (!accessToken) return;
      void registerRiderPush(accessToken).catch((err) => {
        console.warn('[Rider push] register failed:', err);
      });
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => listenForNewOrderBookings(), []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;

    const attach = async () => {
      const received = await listenForPickupPushes();
      if (cancelled) {
        received?.remove();
        return null;
      }

      try {
        const Notifications = await import('expo-notifications');
        responseSub.current?.remove();
        responseSub.current = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const path = extractNotificationPath(
              response.notification.request.content.data,
            );
            if (path) router.push(path as never);
          },
        );

        const last = await Notifications.getLastNotificationResponseAsync();
        const coldPath = extractNotificationPath(
          last?.notification.request.content.data,
        );
        if (coldPath) router.push(coldPath as never);
      } catch (err) {
        console.warn('[Rider push] listener setup failed:', err);
      }

      return received;
    };

    const pending = attach();

    return () => {
      cancelled = true;
      responseSub.current?.remove();
      responseSub.current = null;
      void pending.then((received) => received?.remove());
    };
  }, [router]);

  if (!fontsLoaded && !fontError) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
