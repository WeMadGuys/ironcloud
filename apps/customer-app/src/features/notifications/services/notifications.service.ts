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

let memoryPrefs: NotificationPrefs | null = null;

export function getCachedNotificationPrefs(): NotificationPrefs | null {
  return memoryPrefs;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  if (memoryPrefs) return memoryPrefs;

  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) {
      memoryPrefs = DEFAULT_PREFS;
      return DEFAULT_PREFS;
    }
    const next: NotificationPrefs = { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    memoryPrefs = next;
    return next;
  } catch {
    memoryPrefs = DEFAULT_PREFS;
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  memoryPrefs = prefs;
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}
