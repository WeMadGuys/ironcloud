import { MockAuthProvider } from './mock.provider';
import { TwilioAuthProvider } from './twilio.provider';
import type { AuthProviderType, IAuthProvider } from './types';

export type { IAuthProvider, SendOtpResult, VerifyOtpResult, AuthProviderType } from './types';
export { MockAuthProvider } from './mock.provider';
export { TwilioAuthProvider } from './twilio.provider';

/**
 * Get the configured auth provider based on AUTH_PROVIDER env var.
 *
 * @example
 * // .env
 * AUTH_PROVIDER=mock
 *
 * // Usage
 * const provider = getAuthProvider();
 * await provider.sendOtp('+919876543210');
 */
export const getAuthProvider = (): IAuthProvider => {
  const providerType = (process.env.AUTH_PROVIDER || 'mock') as AuthProviderType;

  switch (providerType) {
    case 'twilio':
      return new TwilioAuthProvider();

    case 'firebase':
      // TODO: Implement FirebaseAuthProvider
      throw new Error('FirebaseAuthProvider not yet implemented.');

    case 'mock':
    default:
      return new MockAuthProvider();
  }
};

/**
 * Check if we're using the mock provider (development mode).
 */
export const isMockAuthProvider = (): boolean => {
  const providerType = process.env.AUTH_PROVIDER || 'mock';
  return providerType === 'mock';
};

/**
 * Check if we're in development mode.
 * Uses NODE_ENV or defaults based on AUTH_PROVIDER.
 */
export const isDevelopmentMode = (): boolean => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return process.env.NODE_ENV === 'development' || isMockAuthProvider();
};
