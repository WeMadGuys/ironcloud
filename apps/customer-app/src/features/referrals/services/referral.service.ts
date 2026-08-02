import { IS_MOCK_AUTH } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

/** Keep warm for a short time so reopen feels instant without stale admin config. */
const CACHE_TTL_MS = 60_000;

export type ReferralProgramSummary = {
  id: string;
  name: string;
  referrerReward: number;
  refereeReward: number;
  minTopup: number;
  shareMessage: string;
};

export type ReferralListItem = {
  id: string;
  status: string;
  friendName: string;
  createdAt: string;
  rewardedAt: string | null;
  rewardAmount: number;
};

export type ReferralMeResponse = {
  code: string;
  program: ReferralProgramSummary | null;
  stats: {
    totalReferred: number;
    pending: number;
    rewarded: number;
    earnedAmount: number;
  };
  referrals: ReferralListItem[];
};

let cachedReferral: { data: ReferralMeResponse; at: number } | null = null;
let inflight: Promise<ReferralMeResponse> | null = null;

export function getCachedReferral(): ReferralMeResponse | null {
  if (!cachedReferral) return null;
  if (Date.now() - cachedReferral.at > CACHE_TTL_MS) return null;
  return cachedReferral.data;
}

export function clearReferralCache(): void {
  cachedReferral = null;
}

async function getAccessToken(): Promise<string | null> {
  if (IS_MOCK_AUTH) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getMyReferral(options?: {
  force?: boolean;
}): Promise<ReferralMeResponse> {
  const force = options?.force === true;
  const cached = getCachedReferral();
  if (!force && cached) return cached;

  if (!force && inflight) return inflight;

  inflight = (async () => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Please sign in to view referrals.');
    }

    const response = await fetch(`${getApiBaseUrl()}/api/referrals/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = (await response.json().catch(() => ({}))) as ReferralMeResponse & {
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || 'Could not load referral details.');
    }

    const data: ReferralMeResponse = {
      code: payload.code,
      program: payload.program ?? null,
      stats: payload.stats ?? {
        totalReferred: 0,
        pending: 0,
        rewarded: 0,
        earnedAmount: 0,
      },
      referrals: payload.referrals ?? [],
    };

    cachedReferral = { data, at: Date.now() };
    return data;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Fire-and-forget warm so Refer & Earn opens instantly after Profile. */
export function prefetchMyReferral(): void {
  if (getCachedReferral() || inflight) return;
  void getMyReferral().catch(() => {
    // Prefetch is best-effort.
  });
}

export async function validateReferralCode(
  code: string,
  communityId?: string | null,
): Promise<{
  valid: boolean;
  message?: string;
  referrerName?: string | null;
  program?: {
    name: string;
    referrerReward: number;
    refereeReward: number;
    minTopup: number;
  };
}> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to validate a referral code.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/referrals/validate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, communityId: communityId ?? null }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    valid?: boolean;
    message?: string;
    error?: string;
    referrerName?: string | null;
    program?: {
      name: string;
      referrerReward: number;
      refereeReward: number;
      minTopup: number;
    };
  };

  if (!response.ok && payload.error) {
    throw new Error(payload.error);
  }

  return {
    valid: Boolean(payload.valid),
    message: payload.message,
    referrerName: payload.referrerName,
    program: payload.program,
  };
}

export async function applyReferralCode(
  code: string,
  communityId?: string | null,
): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Please sign in to apply a referral code.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/referrals/apply`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, communityId: communityId ?? null }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };

  if (!response.ok || !payload.success) {
    throw new Error(payload.error || 'Could not apply referral code.');
  }

  clearReferralCache();
}
