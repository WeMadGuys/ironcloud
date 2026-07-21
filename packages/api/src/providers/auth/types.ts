/**
 * Auth Provider Interface
 *
 * All OTP providers must implement this interface.
 * Switching providers only requires changing AUTH_PROVIDER env var.
 */

export type SendOtpResult = {
  success: boolean;
  message: string;
  /** Only included in development mode for testing */
  otp?: string;
};

export type VerifyOtpResult = {
  success: boolean;
  message: string;
  /** User ID if verification succeeded */
  userId?: string;
  /** Whether this is a new user */
  isNewUser?: boolean;
};

export type AuthProviderConfig = {
  /** Provider type */
  type: 'mock' | 'twilio' | 'firebase';
  /** Whether we're in development mode */
  isDevelopment: boolean;
};

export interface IAuthProvider {
  /**
   * Provider identifier
   */
  readonly name: string;

  /**
   * Send OTP to phone number.
   * In mock mode, no SMS is sent.
   */
  sendOtp(phone: string): Promise<SendOtpResult>;

  /**
   * Verify OTP and authenticate user.
   * Creates user if they don't exist.
   */
  verifyOtp(phone: string, otp: string): Promise<VerifyOtpResult>;

  /**
   * Resend OTP to phone number.
   */
  resendOtp(phone: string): Promise<SendOtpResult>;
}

export type AuthProviderType = 'mock' | 'twilio' | 'firebase';
