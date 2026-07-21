import type { IAuthProvider, SendOtpResult, VerifyOtpResult } from './types';

/**
 * Development OTP code - always use this in mock mode.
 */
const MOCK_OTP = '123456';

/**
 * In-memory store for pending OTP verifications.
 * Maps phone number to OTP sent timestamp.
 */
const pendingVerifications = new Map<string, number>();

/**
 * OTP expiry time in milliseconds (5 minutes).
 */
const OTP_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Mock Auth Provider
 *
 * For development and testing only.
 * - No SMS is sent
 * - OTP is always "123456"
 * - Full auth flow works without external providers
 */
export class MockAuthProvider implements IAuthProvider {
  readonly name = 'mock';

  async sendOtp(phone: string): Promise<SendOtpResult> {
    // Validate phone format (basic validation)
    if (!phone || phone.length < 10) {
      return {
        success: false,
        message: 'Invalid phone number format.',
      };
    }

    // Store verification attempt
    pendingVerifications.set(phone, Date.now());

    // In development, return the OTP in response
    return {
      success: true,
      message: 'Development mode: OTP generated.',
      otp: MOCK_OTP,
    };
  }

  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResult> {
    // Check if there's a pending verification
    const sentAt = pendingVerifications.get(phone);

    if (!sentAt) {
      return {
        success: false,
        message: 'No OTP was requested for this phone number.',
      };
    }

    // Check if OTP has expired
    if (Date.now() - sentAt > OTP_EXPIRY_MS) {
      pendingVerifications.delete(phone);
      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
      };
    }

    // Verify OTP (in mock mode, always "123456")
    if (otp !== MOCK_OTP) {
      return {
        success: false,
        message: 'Invalid OTP. Please try again.',
      };
    }

    // Clear the pending verification
    pendingVerifications.delete(phone);

    // In a real implementation, this would create/fetch the user from Supabase
    // The actual user creation happens in the auth service layer
    return {
      success: true,
      message: 'OTP verified successfully.',
    };
  }

  async resendOtp(phone: string): Promise<SendOtpResult> {
    // Same as sendOtp for mock provider
    return this.sendOtp(phone);
  }
}

/**
 * Singleton instance
 */
export const mockAuthProvider = new MockAuthProvider();
