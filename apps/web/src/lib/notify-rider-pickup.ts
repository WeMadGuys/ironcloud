import type { SupabaseClient } from '@supabase/supabase-js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type AdminClient = SupabaseClient<any>;

/**
 * Tell the assigned rider a pickup was just booked.
 * Missing tokens or Expo errors must not fail the booking.
 */
export async function notifyRiderNewPickup(
  admin: AdminClient,
  params: { riderId: string; orderId: string },
): Promise<void> {
  try {
    const [{ data: tokenRows, error: tokenError }, { data: order, error: orderError }] =
      await Promise.all([
        admin.from('push_tokens').select('expo_push_token').eq('user_id', params.riderId),
        admin
          .from('orders')
          .select('order_number, community_id')
          .eq('id', params.orderId)
          .maybeSingle(),
      ]);

    if (tokenError) {
      console.warn('[rider-push] token lookup failed:', tokenError.message);
      return;
    }
    if (orderError) {
      console.warn('[rider-push] order lookup failed:', orderError.message);
    }

    const tokens = (tokenRows ?? [])
      .map((row: { expo_push_token: string | null }) => row.expo_push_token?.trim())
      .filter((token): token is string => Boolean(token));

    if (tokens.length === 0) {
      console.warn('[rider-push] no device token for rider', params.riderId);
      return;
    }

    let communityName = 'your community';
    if (order?.community_id) {
      const { data: community } = await admin
        .from('communities')
        .select('name')
        .eq('id', order.community_id)
        .maybeSingle();
      if (community?.name) communityName = community.name;
    }

    const orderNumber = order?.order_number || 'New order';
    const path = `/jobs/order/${params.orderId}/pickup`;
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'New pickup',
      body: `${orderNumber} · ${communityName}`,
      channelId: 'pickups',
      data: { path, orderId: params.orderId },
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
      console.warn('[rider-push] Expo send failed:', res.status, text.slice(0, 300));
    }
  } catch (err) {
    console.warn(
      '[rider-push] failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
