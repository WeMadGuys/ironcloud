import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STATE_KEY = 'ironcloud_banner_impressions';

export type BannerImpressionEntry = {
  showCount: number;
};

type BannerImpressionState = Record<string, BannerImpressionEntry>;

let memoryState: BannerImpressionState | null = null;

function readWebStorage(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(STATE_KEY);
  } catch {
    return null;
  }
}

function writeWebStorage(value: string): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STATE_KEY, value);
  } catch {
    // Ignore quota / private mode errors
  }
}

async function readState(): Promise<BannerImpressionState> {
  if (memoryState) return memoryState;

  try {
    const raw =
      Platform.OS === 'web'
        ? readWebStorage()
        : await SecureStore.getItemAsync(STATE_KEY);
    if (!raw) {
      memoryState = {};
      return memoryState;
    }
    const parsed = JSON.parse(raw) as BannerImpressionState;
    memoryState = parsed && typeof parsed === 'object' ? parsed : {};
    return memoryState;
  } catch {
    memoryState = {};
    return memoryState;
  }
}

async function writeState(state: BannerImpressionState): Promise<void> {
  memoryState = state;
  const serialized = JSON.stringify(state);
  if (Platform.OS === 'web') {
    writeWebStorage(serialized);
    return;
  }
  await SecureStore.setItemAsync(STATE_KEY, serialized);
}

export async function getBannerShowCount(bannerId: string): Promise<number> {
  const state = await readState();
  return state[bannerId]?.showCount ?? 0;
}

export async function shouldShowBanner(
  bannerId: string,
  maxImpressions: number,
): Promise<boolean> {
  const count = await getBannerShowCount(bannerId);
  return count < Math.max(1, maxImpressions);
}

/** Record one close/view so the banner stops after maxImpressions. */
export async function recordBannerImpression(bannerId: string): Promise<void> {
  const state = await readState();
  const prev = state[bannerId]?.showCount ?? 0;
  await writeState({
    ...state,
    [bannerId]: { showCount: prev + 1 },
  });
}
