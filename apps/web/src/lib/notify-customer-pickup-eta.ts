import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type AdminClient = SupabaseClient<any>;

export const PICKUP_ETA_TITLE = 'Pickup in 5–10 min';
export const PICKUP_ETA_BODY =
  "We're on the way. Please keep your clothes ready to hand over.";

/**
 * Push the assigned customer a short pickup-arrival notice.
 * Returns false when the customer has no device token.
 */
export async function notifyCustomerPickupEta(
  admin: AdminClient,
  params: { customerId: string; orderId: string },
): Promise<{ sent: boolean }> {
  const { data: tokenRows, error: tokenError } = await admin
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', params.customerId);

  if (tokenError) {
    throw new Error(tokenError.message);
  }

  const tokens = (tokenRows ?? [])
    .map((row: { expo_push_token: string | null }) => row.expo_push_token?.trim())
    .filter((token): token is string => Boolean(token));

  if (tokens.length === 0) return { sent: false };

  const messages = tokens.map((token) => ({
    to: token,
    sound: 'default',
    title: PICKUP_ETA_TITLE,
    body: PICKUP_ETA_BODY,
    channelId: 'default',
    data: { path: `/orders/${params.orderId}`, orderId: params.orderId },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Push failed (${res.status}): ${text.slice(0, 180)}`);
  }

  return { sent: true };
}
