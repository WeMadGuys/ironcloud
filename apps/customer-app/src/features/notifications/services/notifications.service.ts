import * as SecureStore from 'expo-secure-store';

const PREFS_KEY = 'ironcloud_notification_prefs';

export type NotificationPrefs = {
  pushEnabled: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  smsEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  orderUpdates: true,
  promotions: true,
  smsEnabled: false,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}
