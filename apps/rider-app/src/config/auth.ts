export type AuthProviderType = 'mock' | 'twilio' | 'firebase';

export const AUTH_PROVIDER: AuthProviderType =
  (process.env.EXPO_PUBLIC_AUTH_PROVIDER as AuthProviderType) || 'mock';

export const IS_DEVELOPMENT = __DEV__ || AUTH_PROVIDER === 'mock';

export const MOCK_OTP_CODE = '123456';
export const OTP_LENGTH = 6;
export const OTP_RESEND_COOLDOWN_SECONDS = 30;

/** Mock rider profile id for dev (separate from customer mock user). */
export const MOCK_RIDER_ID = '00000000-0000-0000-0000-000000000002';
