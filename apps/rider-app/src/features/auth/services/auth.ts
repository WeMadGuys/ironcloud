import * as SecureStore from 'expo-secure-store';

import {
  AUTH_PROVIDER,
  IS_DEVELOPMENT,
  MOCK_OTP_CODE,
} from '../../../config/auth';
import { supabase } from '../../../lib/supabase';

export type AuthError = { message: string; code?: string };
export type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: AuthError };

const mockOtpStore = new Map<string, { otp: string; timestamp: number }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RIDER_SESSION_KEY = 'rider_auth_session';

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

export async function isRiderAuthenticated(): Promise<boolean> {
  if (AUTH_PROVIDER === 'mock') {
    try {
      const session = await SecureStore.getItemAsync(RIDER_SESSION_KEY);
      return !!session;
    } catch {
      return false;
    }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user;
}

export const sendOtp = async (phone: string) => {
  if (!phone || phone.length < 10) {
    return { data: null, error: { message: 'Please enter a valid phone number.' } };
  }
  const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  if (AUTH_PROVIDER === 'mock') {
    mockOtpStore.set(formattedPhone, { otp: MOCK_OTP_CODE, timestamp: Date.now() });
    return {
      data: {
        success: true,
        message: 'Development mode: OTP generated.',
        otp: IS_DEVELOPMENT ? MOCK_OTP_CODE : undefined,
      },
      error: null,
    };
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
    options: { channel: 'sms' },
  });
  if (error) return { data: null, error: { message: error.message, code: error.code } };
  return { data: { success: true, message: 'OTP sent successfully.' }, error: null };
};

export const verifyOtp = async (phone: string, otp: string) => {
  const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  if (AUTH_PROVIDER === 'mock') {
    const stored = mockOtpStore.get(formattedPhone);
    if (!stored) {
      return { data: null, error: { message: 'No OTP was requested for this number.' } };
    }
    if (Date.now() - stored.timestamp > OTP_EXPIRY_MS) {
      mockOtpStore.delete(formattedPhone);
      return { data: null, error: { message: 'OTP has expired. Please request a new one.' } };
    }
    if (otp !== stored.otp) {
      return { data: null, error: { message: 'Invalid OTP. Please try again.', code: '401' } };
    }
    mockOtpStore.delete(formattedPhone);
    await setRiderSession(formattedPhone);
    return { data: { success: true, userId: formattedPhone, isNewUser: false }, error: null };
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: formattedPhone,
    token: otp,
    type: 'sms',
  });
  if (error) return { data: null, error: { message: error.message, code: error.code } };
  if (!data.user) return { data: null, error: { message: 'Verification failed.' } };
  await setRiderSession(formattedPhone);
  return {
    data: { success: true, userId: data.user.id, isNewUser: !data.user.last_sign_in_at },
    error: null,
  };
};

export const signOut = async () => {
  await clearRiderSession();
  const { error } = await supabase.auth.signOut();
  if (error) return { data: null, error: { message: error.message } };
  return { data: { signedOut: true as const }, error: null };
};
