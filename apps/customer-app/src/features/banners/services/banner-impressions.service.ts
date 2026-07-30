import * as SecureStore from 'expo-secure-store';

const STATE_KEY = 'ironcloud_banner_impressions';

export type BannerImpressionEntry = {
  showCount: number;
};

type BannerImpressionState = Record<string, BannerImpressionEntry>;

let memoryState: BannerImpressionState | null = null;

async function readState(): Promise<BannerImpressionState> {
  if (memoryState) return memoryState;

  try {
    const raw = await SecureStore.getItemAsync(STATE_KEY);
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
  await SecureStore.setItemAsync(STATE_KEY, JSON.stringify(state));
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
