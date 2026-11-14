import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

export async function notifyCustomerPickupEta(orderId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error('Sign in again to notify the customer.');

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/api/rider/notify-pickup-eta`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ orderId }),
    });
  } catch {
    throw new Error('Could not reach the server. Check that you are online.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || 'Could not send the notification.');
  }
}
