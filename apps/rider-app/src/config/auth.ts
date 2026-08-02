/**
 * Auth Configuration — Rider app
 */

export type AuthProviderType = 'mock' | 'msg91';

function resolveAuthProvider(): AuthProviderType {
  const requested = process.env.EXPO_PUBLIC_AUTH_PROVIDER;
  // Release / store builds must never use mock OTP.
  if (!__DEV__) {
    return 'msg91';
  }
  if (requested === 'msg91') return 'msg91';
  return 'mock';
}

export const AUTH_PROVIDER: AuthProviderType = resolveAuthProvider();

/** True only when mock OTP path is active (dev builds only). */
export const IS_MOCK_AUTH = AUTH_PROVIDER === 'mock';

export const IS_DEVELOPMENT = __DEV__;

/**
 * Mock OTP for development — same 4-digit length as MSG91 / customer app.
 */
export const MOCK_OTP_CODE = '1234';

/**
 * OTP length for input validation.
 * MSG91 widget is configured for 4-digit OTPs (same as customer app).
 */
export const OTP_LENGTH = 4;

export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** Mock rider profile id for dev (separate from customer mock user). */
export const MOCK_RIDER_ID = '00000000-0000-0000-0000-000000000002';

/** MSG91 widget id (public). */
export const MSG91_WIDGET_ID = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID ?? '';

/** MSG91 OTP widget token (public — not the account authkey). */
export const MSG91_TOKEN_AUTH = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH ?? '';
