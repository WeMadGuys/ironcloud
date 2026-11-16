import { createClient } from '@supabase/supabase-js';

import { getServerSupabaseEnv } from '@/lib/server-env';

const MAX_MESSAGE_LENGTH = 200;
const DEDUPE_WINDOW_MS = 60_000;

/** 10-digit Indian mobile, or 91 plus those 10 digits. */
export const toTenDigitPhone = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return null;
};

/** Best-effort insert; never throws so a report cannot affect the caller. */
export const recordOtpSendFailure = async ({
  phone,
  message,
}: {
  phone: string;
  message: string;
}): Promise<void> => {
  try {
    const trimmed = message.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!trimmed) return;

    const { url, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length) return;

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const { data: existing, error: lookupError } = await admin
      .from('otp_send_failures')
      .select('id')
      .eq('phone', phone)
      .gte('created_at', since)
      .limit(1);

    if (lookupError) {
      console.error('[otp-send-failures]', lookupError.message);
    } else if (existing && existing.length > 0) {
      return;
    }

    const { error } = await admin.from('otp_send_failures').insert({
      phone,
      message: trimmed,
    });
    if (error) console.error('[otp-send-failures]', error.message);
  } catch (err) {
    console.error('[otp-send-failures]', err);
  }
};
