import crypto from 'node:crypto';

import Razorpay from 'razorpay';

import { ensureServerEnv } from '@/lib/server-env';

export type RazorpayEnv = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  missing: string[];
};

export const getRazorpayEnv = (): RazorpayEnv => {
  ensureServerEnv();

  const keyId = process.env.RAZORPAY_KEY_ID ?? '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  const missing: string[] = [];
  if (!keyId) missing.push('RAZORPAY_KEY_ID');
  if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');

  return { keyId, keySecret, webhookSecret, missing };
};

export const getRazorpayClient = (): Razorpay => {
  const { keyId, keySecret } = getRazorpayEnv();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

export const verifyPaymentSignature = (
  orderId: string,
  paymentId: string,
  signature: string,
): boolean => {
  const { keySecret } = getRazorpayEnv();
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
};

export const verifyWebhookSignature = (body: string, signature: string | null): boolean => {
  const { webhookSecret } = getRazorpayEnv();
  if (!webhookSecret || !signature) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return expected === signature;
};
