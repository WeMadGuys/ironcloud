import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type AdminClient = SupabaseClient<any>;

const COPY = {
  pickup: {
    title: 'Pickup not completed',
    body: 'We could not collect your clothes today. We will try again.',
  },
  delivery: {
    title: 'Delivery not completed',
    body: 'We could not deliver your clothes today. We will try again.',
  },
} as const;

export async function notifyCustomerStopFailed(
  admin: AdminClient,
  params: { customerId: string; orderId: string; jobType: 'pickup' | 'delivery' },
): Promise<void> {
  const { data: tokenRows, error } = await admin
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', params.customerId);

  if (error) throw new Error(error.message);

  const tokens = (tokenRows ?? [])
    .map((row: { expo_push_token: string | null }) => row.expo_push_token?.trim())
    .filter((token): token is string => Boolean(token));

  if (tokens.length === 0) return;

  const copy = COPY[params.jobType];
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        sound: 'default',
        title: copy.title,
        body: copy.body,
        channelId: 'default',
        data: { path: `/orders/${params.orderId}`, orderId: params.orderId },
      })),
    ),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Push failed (${res.status}): ${text.slice(0, 180)}`);
  }
}
