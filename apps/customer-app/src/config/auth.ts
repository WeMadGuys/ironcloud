/**
 * Auth Configuration
 *
 * Determines which auth provider to use and dev mode settings.
 */

export type AuthProviderType = 'mock' | 'msg91';

/**
 * Current auth provider type.
 * Set via EXPO_PUBLIC_AUTH_PROVIDER env var, defaults to 'mock' for development.
 */
export const AUTH_PROVIDER: AuthProviderType =
  (process.env.EXPO_PUBLIC_AUTH_PROVIDER as AuthProviderType) || 'mock';

/**
 * Whether we're in development mode.
 * Shows general dev helpers; mock OTP hint is gated separately on AUTH_PROVIDER.
 */
export const IS_DEVELOPMENT = __DEV__ || AUTH_PROVIDER === 'mock';

/**
 * Mock customer user id used across customer-app services in mock auth.
 * Must match seeded auth/profile row in docs/rider-app-demo-data.sql.
 */
export const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * The mock OTP code used in development.
 * Matches the OTP input length on the login screen.
 */
export const MOCK_OTP_CODE = '1234';

/**
 * OTP length for input validation.
 * MSG91 widget is configured for 4-digit OTPs.
 */
export const OTP_LENGTH = 4;

/**
 * OTP resend cooldown in seconds.
 */
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** MSG91 widget id (public). */
export const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID ?? '';

/** MSG91 OTP widget token (public — not the account authkey). */
export const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH ?? '';
