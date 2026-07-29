import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';

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

async function getAccessToken(): Promise<string | null> {
  if (IS_MOCK_AUTH) {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function getMyReferral(): Promise<ReferralMeResponse> {
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

  return {
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
}
