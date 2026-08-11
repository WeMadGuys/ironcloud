import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '../../../lib/api';
import { isExpoGo } from '../../../lib/expo-go';
import { supabase } from '../../../lib/supabase';
import { getNotificationPrefs } from './notifications.service';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;

async function loadNativeModules(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    Notifications = await import('expo-notifications');
    Device = await import('expo-device');
    return true;
  } catch (err) {
    console.warn('[Push] Native modules unavailable:', err);
    return false;
  }
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postRegister(body: Record<string, unknown>): Promise<void> {
  const token = await accessToken();
  if (!token) return;

  const res = await fetch(`${getApiBaseUrl()}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[Push] register failed:', res.status, text.slice(0, 200));
  }
}

/**
 * Request permission, get Expo push token, upsert to backend.
 * No-ops on web / when push disabled / when native modules missing.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const prefs = await getNotificationPrefs();
  if (!prefs.pushEnabled) {
    return null;
  }

  const ok = await loadNativeModules();
  if (!ok || !Notifications || !Device) return null;

  if (!Device.isDevice) {
    console.warn('[Push] Physical device required for remote push');
    return null;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const existing = (await Notifications.getPermissionsAsync()) as {
    status: string;
    granted?: boolean;
  };
  let finalStatus = existing.status;
  if (existing.status !== 'granted') {
    const requested = (await Notifications.requestPermissionsAsync()) as {
      status: string;
      granted?: boolean;
    };
    finalStatus = requested.status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const easProjectId = projectId();
  if (!easProjectId) {
    console.warn('[Push] Missing EAS projectId in app.json extra.eas');
    return null;
  }

  if (isExpoGo()) {
    console.warn(
      '[Push] Remote push is limited in Expo Go — use a dev build for production testing.',
    );
  }

  const push = await Notifications.getExpoPushTokenAsync({
    projectId: easProjectId,
  });

  await postRegister({
    token: push.data,
    platform: Platform.OS,
    promotionsEnabled: prefs.promotions && prefs.pushEnabled,
  });

  return push.data;
}

/** Sync promotions flag or remove token when push is disabled. */
export async function syncPushRegistration(): Promise<void> {
  if (Platform.OS === 'web') return;

  const prefs = await getNotificationPrefs();
  if (!prefs.pushEnabled) {
    const ok = await loadNativeModules();
    if (!ok || !Notifications) return;
    try {
      const easProjectId = projectId();
      if (!easProjectId) return;
      const push = await Notifications.getExpoPushTokenAsync({
        projectId: easProjectId,
      });
      await postRegister({ token: push.data, remove: true });
    } catch {
      // ignore — token may be unavailable without permission
    }
    return;
  }

  await registerForPushNotifications();
}

export function extractNotificationPath(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const path = (data as { path?: unknown }).path;
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return null;
  return trimmed;
}
