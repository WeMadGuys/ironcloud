import {
  MSG91_TOKEN_AUTH,
  MSG91_WIDGET_ID,
} from '../../../config/auth';

const MSG91_BASE = 'https://control.msg91.com/api/v5/widget';

let initialized = false;
const reqIdByPhone = new Map<string, string>();

type Msg91Response = {
  type?: string;
  message?: string;
  reqId?: string;
  data?: { reqId?: string; message?: string };
};

const isSuccess = (res: Msg91Response | undefined | null): boolean => {
  if (!res) return false;
  if (res.type === 'error') return false;
  if (res.type === 'success') return true;
  return Boolean(res.message || res.reqId || res.data?.reqId);
};

const extractMessage = (res: Msg91Response | undefined | null): string => {
  if (!res) return 'MSG91 request failed.';
  if (typeof res.message === 'string' && res.message) return res.message;
  if (typeof res.data?.message === 'string' && res.data.message) {
    return res.data.message;
  }
  return 'MSG91 request failed.';
};

const extractReqId = (res: Msg91Response): string | null => {
  if (typeof res.reqId === 'string' && res.reqId) return res.reqId;
  if (typeof res.data?.reqId === 'string' && res.data.reqId) return res.data.reqId;
  if (res.type === 'success' && typeof res.message === 'string' && res.message) {
    return res.message;
  }
  return null;
};

const postMsg91 = async (
  path: string,
  body: Record<string, unknown>,
): Promise<Msg91Response> => {
  const response = await fetch(`${MSG91_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_TOKEN_AUTH,
      ...body,
    }),
  });

  try {
    return (await response.json()) as Msg91Response;
  } catch {
    return { type: 'error', message: 'Invalid response from MSG91.' };
  }
};

/** MSG91 identifier: country code + number, no + (e.g. 919876543210). */
export const toMsg91Identifier = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  return digits;
};

export const ensureMsg91Initialized = async (): Promise<void> => {
  if (initialized) return;

  if (!MSG91_WIDGET_ID || !MSG91_TOKEN_AUTH) {
    throw new Error(
      'MSG91 is not configured for rider-app. Add EXPO_PUBLIC_MSG91_WIDGET_ID and EXPO_PUBLIC_MSG91_TOKEN_AUTH to apps/rider-app/.env (same values as customer-app), then restart with --clear.',
    );
  }

  initialized = true;
};

export const msg91SendOtp = async (
  phone: string,
): Promise<{ reqId: string } | { error: string }> => {
  await ensureMsg91Initialized();

  const identifier = toMsg91Identifier(phone);
  const response = await postMsg91('/sendOtpMobile', { identifier });

  if (!isSuccess(response)) {
    return { error: extractMessage(response) };
  }

  const reqId = extractReqId(response);
  if (!reqId) {
    return { error: 'OTP sent but request id was missing. Please try again.' };
  }

  reqIdByPhone.set(identifier, reqId);
  return { reqId };
};

export const msg91RetryOtp = async (
  phone: string,
): Promise<{ reqId: string } | { error: string }> => {
  await ensureMsg91Initialized();

  const identifier = toMsg91Identifier(phone);
  const existingReqId = reqIdByPhone.get(identifier);

  if (!existingReqId) {
    return msg91SendOtp(phone);
  }

  const response = await postMsg91('/retryOtp', {
    reqId: existingReqId,
    retryChannel: 11, // SMS
  });

  if (!isSuccess(response)) {
    return msg91SendOtp(phone);
  }

  const nextReqId = extractReqId(response) ?? existingReqId;
  reqIdByPhone.set(identifier, nextReqId);
  return { reqId: nextReqId };
};

export const msg91VerifyOtp = async (
  phone: string,
  otp: string,
): Promise<{ accessToken: string } | { error: string }> => {
  await ensureMsg91Initialized();

  const identifier = toMsg91Identifier(phone);
  const reqId = reqIdByPhone.get(identifier);

  if (!reqId) {
    return { error: 'No OTP was requested for this number.' };
  }

  const response = await postMsg91('/verifyOtp', { reqId, otp });

  if (!isSuccess(response)) {
    return { error: extractMessage(response) || 'Invalid OTP. Please try again.' };
  }

  const accessToken =
    (typeof response.message === 'string' && response.message) ||
    (typeof response.data?.message === 'string' && response.data.message) ||
    null;

  if (!accessToken) {
    return { error: 'OTP verified but access token was missing.' };
  }

  reqIdByPhone.delete(identifier);
  return { accessToken };
};
