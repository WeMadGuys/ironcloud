/**
 * Auth Configuration
 *
 * Determines which auth provider to use and dev mode settings.
 */

export type AuthProviderType = 'mock' | 'twilio' | 'firebase';

/**
 * Current auth provider type.
 * Set via AUTH_PROVIDER env var, defaults to 'mock' for development.
 */
export const AUTH_PROVIDER: AuthProviderType =
  (process.env.EXPO_PUBLIC_AUTH_PROVIDER as AuthProviderType) || 'mock';

/**
 * Whether we're in development mode.
 * Shows dev helpers like the mock OTP hint.
 */
export const IS_DEVELOPMENT = __DEV__ || AUTH_PROVIDER === 'mock';

/**
 * The mock OTP code used in development.
 */
export const MOCK_OTP_CODE = '123456';

/**
 * OTP length for input validation.
 */
export const OTP_LENGTH = 6;

/**
 * OTP resend cooldown in seconds.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 30;
