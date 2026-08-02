/**
 * Auth Configuration
 *
 * Determines which auth provider to use and dev mode settings.
 */

export type AuthProviderType = 'mock' | 'msg91';

function resolveAuthProvider(): AuthProviderType {
  const requested = process.env.EXPO_PUBLIC_AUTH_PROVIDER;
  // Release / store builds must never use mock OTP (security / review reject).
  if (!__DEV__) {
    return 'msg91';
  }
  if (requested === 'msg91') return 'msg91';
  // Default to mock in development when unset or explicitly "mock".
  return 'mock';
}

/**
 * Current auth provider type.
 * Release builds always resolve to msg91 regardless of env.
 */
export const AUTH_PROVIDER: AuthProviderType = resolveAuthProvider();

/** True only when mock OTP path is active (dev builds only). */
export const IS_MOCK_AUTH = AUTH_PROVIDER === 'mock';

/**
 * Whether we're in development mode.
 * Shows general dev helpers; mock OTP hint is gated on IS_MOCK_AUTH.
 */
export const IS_DEVELOPMENT = __DEV__;

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
