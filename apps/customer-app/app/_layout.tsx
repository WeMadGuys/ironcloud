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

import { onAuthStateChange } from '../src/features/auth';
import {
  extractNotificationPath,
  registerForPushNotifications,
} from '../src/features/notifications/services/push.service';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const router = useRouter();
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
  const responseSub = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cancelled = false;

    const setupPush = async () => {
      await registerForPushNotifications();
      if (cancelled) return;

      try {
        const Notifications = await import('expo-notifications');
        responseSub.current?.remove();
        responseSub.current = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const path = extractNotificationPath(
              response.notification.request.content.data,
            );
            if (path) {
              router.push(path as never);
            }
          },
        );

        const last = await Notifications.getLastNotificationResponseAsync();
        const coldPath = extractNotificationPath(
          last?.notification.request.content.data,
        );
        if (coldPath) {
          router.push(coldPath as never);
        }
      } catch (err) {
        console.warn('[Push] listener setup failed:', err);
      }
    };

    const { data: authSub } = onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        void setupPush();
      }
    });

    void setupPush();

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      responseSub.current?.remove();
      responseSub.current = null;
    };
  }, [router]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
