import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;

const pickupListeners = new Set<() => void>();

/** Home refreshes when a pickup push arrives while the app is open. */
export function onPickupPush(listener: () => void): () => void {
  pickupListeners.add(listener);
  return () => {
    pickupListeners.delete(listener);
  };
}

function emitPickupPush(): void {
  pickupListeners.forEach((listener) => listener());
}

async function loadNativeModules(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    Notifications = await import('expo-notifications');
    Device = await import('expo-device');
    return true;
  } catch (err) {
    console.warn('[Rider push] Native modules unavailable:', err);
    return false;
  }
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
}

export function extractNotificationPath(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const path = (data as { path?: unknown }).path;
  return typeof path === 'string' && path.startsWith('/') ? path : null;
}

/**
 * Ask for permission and store this rider's Expo token.
 * Job alerts are operational, so this does not depend on promotion prefs.
 */
export async function registerRiderPush(accessToken: string): Promise<void> {
  if (Platform.OS === 'web' || !accessToken.trim()) return;

  const ok = await loadNativeModules();
  if (!ok || !Notifications || !Device || !Device.isDevice) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    console.warn('[Rider push] permission not granted');
    return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('pickups', {
      name: 'Pickups',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  const easProjectId = projectId();
  if (!easProjectId) {
    console.warn('[Rider push] Missing EAS projectId');
    return;
  }

  const push = await Notifications.getExpoPushTokenAsync({ projectId: easProjectId });
  const res = await fetch(`${getApiBaseUrl()}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token: push.data,
      platform: Platform.OS,
      promotionsEnabled: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[Rider push] register failed:', res.status, text.slice(0, 200));
  }
}

/** Foreground pickup alerts refresh the job list. */
export async function listenForPickupPushes(): Promise<{ remove: () => void } | null> {
  const ok = await loadNativeModules();
  if (!ok || !Notifications) return null;

  const received = Notifications.addNotificationReceivedListener((notification) => {
    const path = extractNotificationPath(notification.request.content.data);
    if (path?.includes('/jobs/order/')) emitPickupPush();
  });

  return {
    remove: () => received.remove(),
  };
}

export async function riderSessionToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
