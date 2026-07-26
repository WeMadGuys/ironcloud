/**
 * Auth Configuration — Rider app
 */

export type AuthProviderType = 'mock' | 'msg91';

export const AUTH_PROVIDER: AuthProviderType =
  (process.env.EXPO_PUBLIC_AUTH_PROVIDER as AuthProviderType) || 'mock';

export const IS_DEVELOPMENT = __DEV__ || AUTH_PROVIDER === 'mock';

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
