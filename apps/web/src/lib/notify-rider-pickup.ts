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
          .select(
            `
            order_number,
            address:address_id (
              flat_number,
              tower,
              community:community_id (name)
            )
          `,
          )
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

    const address = (
      order as {
        address?: {
          flat_number?: string | null;
          tower?: string | null;
          community?: { name?: string | null } | null;
        } | null;
      } | null
    )?.address;
    const communityName = address?.community?.name?.trim() || 'your community';
    const place = [
      address?.tower?.trim() ? `Tower ${address.tower.trim()}` : null,
      address?.flat_number?.trim() ? `Flat ${address.flat_number.trim()}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    const body = place
      ? `Pickup at ${communityName}, ${place}.`
      : `Pickup at ${communityName}.`;

    const path = `/jobs/order/${params.orderId}/pickup`;
    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: 'New order booked',
      body,
      priority: 'high' as const,
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

    const payload = (await res.json().catch(() => null)) as {
      data?: { status?: string; message?: string }[];
    } | null;
    if (!res.ok) {
      console.warn('[rider-push] Expo send failed:', res.status);
      return;
    }
    const rejected = (payload?.data ?? []).filter((ticket) => ticket.status === 'error');
    if (rejected.length > 0) {
      console.warn('[rider-push] Expo rejected:', rejected[0]?.message);
    }
  } catch (err) {
    console.warn(
      '[rider-push] failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
