import * as SecureStore from 'expo-secure-store';

import {
  AUTH_PROVIDER,
  IS_DEVELOPMENT,
  MOCK_OTP_CODE,
  MOCK_RIDER_ID,
} from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { msg91RetryOtp, msg91SendOtp, msg91VerifyOtp } from './msg91';

export type AuthError = { message: string; code?: string };
export type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthError };

export type SendOtpResponse = {
  success: boolean;
  message: string;
  otp?: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  userId?: string;
  isNewUser?: boolean;
  isActive?: boolean;
};

const mockOtpStore = new Map<string, { otp: string; timestamp: number }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RIDER_SESSION_KEY = 'rider_auth_session';

const formatPhone = (phone: string) =>
  phone.startsWith('+') ? phone : `+91${phone}`;

async function setRiderSession(phone: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(RIDER_SESSION_KEY, phone);
  } catch {
    // ignore storage errors in dev
  }
}

async function clearRiderSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(RIDER_SESSION_KEY);
  } catch {
    // ignore
  }
}

/** Fetch is_active for the current rider (or mock rider id). */
export const getRiderActivation = async (
  riderId?: string,
): Promise<{ isActive: boolean; riderId: string | null; error?: string }> => {
  let id = riderId ?? null;

  if (!id) {
    if (AUTH_PROVIDER === 'mock') {
      id = MOCK_RIDER_ID;
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      id = sessionData.session?.user?.id ?? null;
      if (!id) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        id = user?.id ?? null;
      }
    }
  }

  if (!id) return { isActive: false, riderId: null, error: 'Not signed in.' };

  const { data, error } = await supabase
    .from('riders')
    .select('is_active')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getRiderActivation]', error.message);
    return {
      isActive: false,
      riderId: id,
      error: error.message,
    };
  }

  if (!data) {
    return {
      isActive: false,
      riderId: id,
      error: 'Rider profile not found.',
    };
  }

  return { isActive: Boolean(data.is_active), riderId: id };
};

export async function isRiderAuthenticated(): Promise<boolean> {
  if (AUTH_PROVIDER === 'mock') {
    try {
      const session = await SecureStore.getItemAsync(RIDER_SESSION_KEY);
      return !!session;
    } catch {
      return false;
    }
  }

  // Prefer local session (fast, works right after setSession). getUser() hits the network.
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) return true;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

const SESSION_FETCH_TIMEOUT_MS = 15000;

const exchangeMsg91Session = async (
  accessToken: string,
  phone: string,
): Promise<AuthResult<VerifyOtpResponse>> => {
  const apiBase = getApiBaseUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SESSION_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/auth/msg91-session-rider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, phone }),
      signal: controller.signal,
    });
  } catch (err) {
    const aborted =
      (err instanceof Error && err.name === 'AbortError') ||
      (typeof err === 'object' &&
        err !== null &&
        'name' in err &&
        (err as { name?: string }).name === 'AbortError');
    return {
      data: null,
      error: {
        message: aborted
          ? `Login server timed out (${apiBase}). Is web:dev running and reachable from this phone?`
          : `Cannot reach login server (${apiBase}). Use the same Wi‑Fi as your PC, or set EXPO_PUBLIC_API_URL to a public URL.`,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: {
    error?: string;
    success?: boolean;
    userId?: string;
    isNewUser?: boolean;
    isActive?: boolean;
    accessToken?: string;
    refreshToken?: string;
  };

  try {
    payload = await response.json();
  } catch {
    return {
      data: null,
      error: { message: 'Invalid response from login server.' },
    };
  }

  if (!response.ok || !payload.success || !payload.accessToken || !payload.refreshToken) {
    return {
      data: null,
      error: {
        message: payload.error || 'Failed to create session. Is the web API running?',
      },
    };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
  });

  if (sessionError || !sessionData.user || !sessionData.session) {
    return {
      data: null,
      error: {
        message: sessionError?.message || 'Failed to store session.',
      },
    };
  }

  // Confirm session is readable (catches web storage failures early)
  const { data: check } = await supabase.auth.getSession();
  if (!check.session?.user?.id) {
    return {
      data: null,
      error: {
        message: 'Session could not be saved. Please try again.',
      },
    };
  }

  return {
    data: {
      success: true,
      userId: payload.userId ?? sessionData.user.id,
      isNewUser: payload.isNewUser,
      isActive: payload.isActive ?? false,
    },
    error: null,
  };
};

export const sendOtp = async (
  phone: string,
): Promise<AuthResult<SendOtpResponse>> => {
  try {
    if (!phone || phone.length < 10) {
      return {
        data: null,
        error: { message: 'Please enter a valid phone number.' },
      };
    }

    const formattedPhone = formatPhone(phone);

    if (AUTH_PROVIDER === 'mock') {
      mockOtpStore.set(formattedPhone, {
        otp: MOCK_OTP_CODE,
        timestamp: Date.now(),
      });

      return {
        data: {
          success: true,
          message: 'Development mode: OTP generated.',
          otp: IS_DEVELOPMENT ? MOCK_OTP_CODE : undefined,
        },
        error: null,
      };
    }

    if (AUTH_PROVIDER === 'msg91') {
      const result = await msg91SendOtp(phone);
      if ('error' in result) {
        return { data: null, error: { message: result.error } };
      }

      return {
        data: { success: true, message: 'OTP sent successfully.' },
        error: null,
      };
    }

    return {
      data: null,
      error: { message: `Unsupported auth provider: ${AUTH_PROVIDER}` },
    };
  } catch {
    return {
      data: null,
      error: { message: 'Failed to send OTP. Please try again.' },
    };
  }
};

export const verifyOtp = async (
  phone: string,
  otp: string,
): Promise<AuthResult<VerifyOtpResponse>> => {
  try {
    const formattedPhone = formatPhone(phone);

    if (AUTH_PROVIDER === 'mock') {
      const stored = mockOtpStore.get(formattedPhone);
      if (!stored) {
        return {
          data: null,
          error: { message: 'No OTP was requested for this number.' },
        };
      }
      if (Date.now() - stored.timestamp > OTP_EXPIRY_MS) {
        mockOtpStore.delete(formattedPhone);
        return {
          data: null,
          error: { message: 'OTP has expired. Please request a new one.' },
        };
      }
      if (otp !== stored.otp) {
        return {
          data: null,
          error: { message: 'Invalid OTP. Please try again.', code: '401' },
        };
      }
      mockOtpStore.delete(formattedPhone);
      await setRiderSession(formattedPhone);

      const { isActive } = await getRiderActivation(MOCK_RIDER_ID);

      return {
        data: {
          success: true,
          userId: MOCK_RIDER_ID,
          isNewUser: false,
          isActive,
        },
        error: null,
      };
    }

    if (AUTH_PROVIDER === 'msg91') {
      const verified = await msg91VerifyOtp(phone, otp);
      if ('error' in verified) {
        return { data: null, error: { message: verified.error } };
      }

      return exchangeMsg91Session(verified.accessToken, phone);
    }

    return {
      data: null,
      error: { message: `Unsupported auth provider: ${AUTH_PROVIDER}` },
    };
  } catch {
    return {
      data: null,
      error: { message: 'Verification failed. Please try again.' },
    };
  }
};

export const resendOtp = async (
  phone: string,
): Promise<AuthResult<SendOtpResponse>> => {
  if (AUTH_PROVIDER === 'msg91') {
    try {
      const result = await msg91RetryOtp(phone);
      if ('error' in result) {
        return { data: null, error: { message: result.error } };
      }
      return {
        data: { success: true, message: 'OTP resent successfully.' },
        error: null,
      };
    } catch {
      return {
        data: null,
        error: { message: 'Failed to resend OTP. Please try again.' },
      };
    }
  }

  return sendOtp(phone);
};

export const signOut = async () => {
  await clearRiderSession();
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: { message: error.message } };
  return { data: { signedOut: true as const }, error: null };
};

/**
 * Permanently delete the signed-in rider account (Play / App Store requirement).
 */
export const deleteAccount = async (): Promise<AuthResult<{ deleted: true }>> => {
  if (AUTH_PROVIDER === 'mock') {
    await signOut();
    return { data: { deleted: true }, error: null };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return {
      data: null,
      error: { message: 'Please sign in again to delete your account.' },
    };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/account/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ confirm: true }),
    });

    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: body?.error || 'Could not delete account. Please try again.',
        },
      };
    }
  } catch {
    return {
      data: null,
      error: { message: 'Could not reach the server. Check your connection.' },
    };
  }

  await signOut();
  return { data: { deleted: true }, error: null };
};
