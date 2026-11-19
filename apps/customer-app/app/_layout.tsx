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
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { onAuthStateChange } from '../src/features/auth';
import { ForceUpdateScreen } from '../src/features/app-update/ForceUpdateScreen';
import {
  checkRequiredUpdate,
  type UpdatePolicy,
} from '../src/features/app-update/policy';
import {
  extractNotificationPath,
  peekPendingNotificationHref,
  peekPendingNotificationVersion,
  registerForPushNotifications,
  setPendingNotificationHref,
  subscribePendingNotificationHref,
} from '../src/features/notifications/services/push.service';

SplashScreen.preventAutoHideAsync();

const COLD_START_NOTIFICATION_MAX_AGE_MS = 60_000;

type NotificationResponseLike = {
  notification: {
    date?: number;
    request: {
      identifier: string;
      content: { data: unknown };
    };
  };
};

function NotificationTapNavigator() {
  const router = useRouter();
  const appliedVersion = useRef(0);

  const openPending = useCallback(() => {
    const version = peekPendingNotificationVersion();
    if (appliedVersion.current === version) return;
    const href = peekPendingNotificationHref();
    if (!href) return;
    appliedVersion.current = version;
    router.navigate(href as never);
  }, [router]);

  useEffect(() => {
    openPending();
    return subscribePendingNotificationHref(openPending);
  }, [openPending]);

  return null;
}

function sessionAccessToken(session: unknown): string | null {
  if (!session || typeof session !== 'object') return null;
  const token = (session as { access_token?: unknown }).access_token;
  return typeof token === 'string' && token.trim() ? token : null;
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
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
  const [updateGate, setUpdateGate] = useState<'checking' | 'ok' | 'required'>(
    Platform.OS === 'web' ? 'ok' : 'checking',
  );
  const [updatePolicy, setUpdatePolicy] = useState<UpdatePolicy | null>(null);

  const refreshUpdateGate = useCallback(async () => {
    if (Platform.OS === 'web') {
      setUpdateGate('ok');
      return;
    }
    try {
      const result = await checkRequiredUpdate();
      setUpdatePolicy(result.policy);
      setUpdateGate(result.required ? 'required' : 'ok');
    } catch {
      setUpdateGate((current) => (current === 'required' ? 'required' : 'ok'));
    }
  }, []);

  useEffect(() => {
    void refreshUpdateGate();
    const timeout = setTimeout(() => {
      setUpdateGate((current) => (current === 'checking' ? 'ok' : current));
    }, 4000);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshUpdateGate();
    });
    return () => {
      clearTimeout(timeout);
      appState.remove();
    };
  }, [refreshUpdateGate]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && updateGate !== 'checking') {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, updateGate]);

  useEffect(() => {
    let cancelled = false;

    const { data: authSub } = onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        const inAuthGroup = segments[0] === '(auth)';
        if (!inAuthGroup) {
          router.replace('/(auth)/login');
        }
        return;
      }
      if (Platform.OS === 'web') return;
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'INITIAL_SESSION'
      ) {
        const accessToken = sessionAccessToken(session);
        if (!accessToken) return;
        void registerForPushNotifications({ accessToken }).catch((err) => {
          console.warn('[Push] register from auth event failed:', err);
        });
      }
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
    };
  }, [router, segments]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handledIds = new Set<string>();

    const acceptResponse = (
      response: NotificationResponseLike,
      options?: { maxAgeMs?: number },
    ) => {
      const id = response.notification.request.identifier;
      if (!id || handledIds.has(id)) return;
      if (options?.maxAgeMs != null) {
        const date = response.notification.date;
        if (typeof date !== 'number' || Date.now() - date > options.maxAgeMs) {
          return;
        }
      }
      const href = extractNotificationPath(response.notification.request.content.data);
      if (!href) return;
      handledIds.add(id);
      setPendingNotificationHref(href);
    };

    const attachTapListener = async () => {
      try {
        const Notifications = await import('expo-notifications');
        responseSub.current?.remove();
        responseSub.current = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            acceptResponse(response);
          },
        );

        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          acceptResponse(last, { maxAgeMs: COLD_START_NOTIFICATION_MAX_AGE_MS });
        }
      } catch (err) {
        console.warn('[Push] listener setup failed:', err);
      }
    };

    void attachTapListener();

    return () => {
      responseSub.current?.remove();
      responseSub.current = null;
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  if (updateGate === 'checking') {
    return null;
  }

  if (updateGate === 'required' && updatePolicy) {
    return <ForceUpdateScreen policy={updatePolicy} />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <NotificationTapNavigator />
    </>
  );
}
