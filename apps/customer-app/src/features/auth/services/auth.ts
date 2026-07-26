import {
  AUTH_PROVIDER,
  IS_DEVELOPMENT,
  MOCK_OTP_CODE,
  MOCK_USER_ID,
} from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { msg91RetryOtp, msg91SendOtp, msg91VerifyOtp } from './msg91';

export type AuthError = {
  message: string;
  code?: string;
};

export type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthError };

export type SendOtpResponse = {
  success: boolean;
  message: string;
  /** Only present in development mode */
  otp?: string;
};

export type VerifyOtpResponse = {
  success: boolean;
  userId?: string;
  isNewUser?: boolean;
};

/**
 * In-memory store for mock OTP verification.
 */
const mockOtpStore = new Map<string, { otp: string; timestamp: number }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const formatPhone = (phone: string) =>
  phone.startsWith('+') ? phone : `+91${phone}`;

const exchangeMsg91Session = async (
  accessToken: string,
  phone: string,
): Promise<AuthResult<VerifyOtpResponse>> => {
  const response = await fetch(`${getApiBaseUrl()}/api/auth/msg91-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, phone }),
  });

  let payload: {
    error?: string;
    success?: boolean;
    userId?: string;
    isNewUser?: boolean;
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
    },
    error: null,
  };
};

/**
 * Send OTP to phone number.
 * mock → local code; msg91 → MSG91 SMS.
 */
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

/**
 * Verify OTP and sign in user.
 * Creates user profile if they don't exist.
 */
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

      return {
        data: {
          success: true,
          userId: MOCK_USER_ID,
          isNewUser: false,
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

/**
 * Resend OTP to phone number.
 */
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

/**
 * Sign out the current user.
 */
export const signOut = async (): Promise<
  AuthResult<{ signedOut: true }>
> => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return { data: { signedOut: true }, error: null };
  } catch {
    return {
      data: null,
      error: { message: 'Sign out failed. Please try again.' },
    };
  }
};

/**
 * Get current session.
 */
export const getSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
};

/**
 * Get current user.
 */
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
};

/**
 * Subscribe to auth state changes.
 */
export const onAuthStateChange = (
  callback: (event: string, session: unknown) => void,
) => {
  return supabase.auth.onAuthStateChange(callback);
};
