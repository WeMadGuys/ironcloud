import type { IAuthProvider, SendOtpResult, VerifyOtpResult } from './types';

/**
 * Twilio Auth Provider
 *
 * Production SMS provider using Twilio Verify API.
 * Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SID.
 *
 * @future Implementation pending Twilio integration
 */
export class TwilioAuthProvider implements IAuthProvider {
  readonly name = 'twilio';

  constructor() {
    // Validate required environment variables
    const required = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_VERIFY_SID',
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.warn(
        `[TwilioAuthProvider] Missing environment variables: ${missing.join(', ')}`,
      );
    }
  }

  async sendOtp(phone: string): Promise<SendOtpResult> {
    // TODO: Implement Twilio Verify API integration
    // const client = require('twilio')(accountSid, authToken);
    // await client.verify.v2.services(verifySid).verifications.create({
    //   to: phone,
    //   channel: 'sms'
    // });

    throw new Error(
      'TwilioAuthProvider not implemented. Set AUTH_PROVIDER=mock for development.',
    );
  }

  async verifyOtp(phone: string, otp: string): Promise<VerifyOtpResult> {
    // TODO: Implement Twilio Verify API verification
    // const client = require('twilio')(accountSid, authToken);
    // const check = await client.verify.v2.services(verifySid)
    //   .verificationChecks.create({ to: phone, code: otp });
    // return check.status === 'approved';

    throw new Error(
      'TwilioAuthProvider not implemented. Set AUTH_PROVIDER=mock for development.',
    );
  }

  async resendOtp(phone: string): Promise<SendOtpResult> {
    return this.sendOtp(phone);
  }
}

/**
 * Singleton instance
 */
export const twilioAuthProvider = new TwilioAuthProvider();
