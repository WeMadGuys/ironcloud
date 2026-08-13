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

async function sessionAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

async function postRegister(
  accessToken: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn('[Push] register failed:', res.status, text.slice(0, 200));
  }
}

/** Logged-in skips/failures show up in Vercel as POST /api/push/register. */
async function reportPushIssue(
  accessToken: string,
  stage: string,
  message: string,
): Promise<void> {
  try {
    await postRegister(accessToken, {
      diagnostic: true,
      stage,
      message: message.slice(0, 500),
      platform: Platform.OS,
    });
  } catch {
    // Diagnostic only — never block login.
  }
}

/**
 * Request permission, get Expo push token, upsert to backend.
 * Requires a session access token — never registers while logged out.
 */
export async function registerForPushNotifications(options?: {
  accessToken?: string | null;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const accessToken = options?.accessToken?.trim() || (await sessionAccessToken());
  if (!accessToken) {
    console.warn('[Push] skipped: no session token (user not logged in)');
    return null;
  }

  const prefs = await getNotificationPrefs();
  if (!prefs.pushEnabled) {
    console.warn('[Push] skipped: push disabled in prefs');
    await reportPushIssue(accessToken, 'prefs', 'push disabled in prefs');
    return null;
  }

  const ok = await loadNativeModules();
  if (!ok || !Notifications || !Device) {
    await reportPushIssue(accessToken, 'native', 'expo-notifications / expo-device unavailable');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push] Physical device required for remote push');
    await reportPushIssue(accessToken, 'device', 'emulator — physical device required');
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
    console.warn('[Push] skipped: notification permission not granted');
    await reportPushIssue(accessToken, 'permission', `status=${finalStatus}`);
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const easProjectId = projectId();
  if (!easProjectId) {
    console.warn('[Push] Missing EAS projectId in app.json extra.eas');
    await reportPushIssue(accessToken, 'config', 'missing extra.eas.projectId');
    return null;
  }

  if (isExpoGo()) {
    console.warn(
      '[Push] Remote push is limited in Expo Go — use a dev build for production testing.',
    );
  }

  try {
    const push = await Notifications.getExpoPushTokenAsync({
      projectId: easProjectId,
    });

    await postRegister(accessToken, {
      token: push.data,
      platform: Platform.OS,
      promotionsEnabled: prefs.promotions && prefs.pushEnabled,
    });

    return push.data;
  } catch (err) {
    console.warn('[Push] getExpoPushTokenAsync failed:', err);
    await reportPushIssue(accessToken, 'token', errorMessage(err));
    return null;
  }
}

/** Sync promotions flag or remove token when push is disabled. */
export async function syncPushRegistration(): Promise<void> {
  if (Platform.OS === 'web') return;

  const accessToken = await sessionAccessToken();
  if (!accessToken) {
    console.warn('[Push] skipped sync: no session token');
    return;
  }

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
      await postRegister(accessToken, { token: push.data, remove: true });
    } catch (err) {
      console.warn('[Push] token remove failed:', err);
    }
    return;
  }

  await registerForPushNotifications({ accessToken });
}

export function extractNotificationPath(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const path = (data as { path?: unknown }).path;
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return null;
  return trimmed;
}
