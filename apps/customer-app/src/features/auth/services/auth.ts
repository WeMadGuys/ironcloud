import {
  AUTH_PROVIDER,
  IS_DEVELOPMENT,
  MOCK_OTP_CODE,
} from '../../../config/auth';
import { supabase } from '../../../lib/supabase';

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

/**
 * Send OTP to phone number.
 * Uses mock provider in development, Supabase Auth in production.
 */
export const sendOtp = async (
  phone: string,
): Promise<AuthResult<SendOtpResponse>> => {
  try {
    // Validate phone
    if (!phone || phone.length < 10) {
      return {
        data: null,
        error: { message: 'Please enter a valid phone number.' },
      };
    }

    // Format phone with country code if needed
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    if (AUTH_PROVIDER === 'mock') {
      // Mock provider - no SMS sent
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

    // Production: Use Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      phone: formattedPhone,
      options: {
        channel: 'sms',
      },
    });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    return {
      data: {
        success: true,
        message: 'OTP sent successfully.',
      },
      error: null,
    };
  } catch (err) {
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
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    if (AUTH_PROVIDER === 'mock') {
      // Mock provider verification
      const stored = mockOtpStore.get(formattedPhone);

      if (!stored) {
        return {
          data: null,
          error: { message: 'No OTP was requested for this number.' },
        };
      }

      // Check expiry
      if (Date.now() - stored.timestamp > OTP_EXPIRY_MS) {
        mockOtpStore.delete(formattedPhone);
        return {
          data: null,
          error: { message: 'OTP has expired. Please request a new one.' },
        };
      }

      // Verify OTP
      if (otp !== stored.otp) {
        return {
          data: null,
          error: { message: 'Invalid OTP. Please try again.', code: '401' },
        };
      }

      // Clear stored OTP
      mockOtpStore.delete(formattedPhone);

      // In mock mode, we still use Supabase for session management
      // but we bypass the OTP verification
      // Sign in with a magic link or create a custom session

      // For development, use Supabase's signInWithPassword with a dev account
      // or use the admin API to create a session

      // Simplified: Use Supabase's phone auth in test mode
      // Supabase allows OTP '123456' in test mode when configured
      const { data, error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: { channel: 'sms' },
      });

      // Immediately verify with the mock OTP
      const verifyResult = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (verifyResult.error) {
        // If Supabase verification fails in mock mode,
        // we create a mock session for development
        console.warn(
          '[MockAuth] Supabase OTP verification failed, using mock session.',
        );

        return {
          data: {
            success: true,
            userId: `mock-user-${formattedPhone}`,
            isNewUser: true,
          },
          error: null,
        };
      }

      return {
        data: {
          success: true,
          userId: verifyResult.data.user?.id,
          isNewUser: !verifyResult.data.user?.last_sign_in_at,
        },
        error: null,
      };
    }

    // Production: Verify with Supabase
    const { data, error } = await supabase.auth.verifyOtp({
      phone: formattedPhone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }

    if (!data.user) {
      return {
        data: null,
        error: { message: 'Verification failed. Please try again.' },
      };
    }

    return {
      data: {
        success: true,
        userId: data.user.id,
        isNewUser: !data.user.last_sign_in_at,
      },
      error: null,
    };
  } catch (err) {
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
  } catch (err) {
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
