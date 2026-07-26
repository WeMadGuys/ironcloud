import * as SecureStore from 'expo-secure-store';

import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';
const PREFS_KEY = 'ironcloud_notification_prefs';

export type ActivityItem = {
  id: string;
  title: string;
  description: string;
  orderNumber: string;
  status: string;
  createdAt: string;
};

export type NotificationPrefs = {
  pushEnabled: boolean;
  orderUpdates: boolean;
  promotions: boolean;
  smsEnabled: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  pushEnabled: true,
  orderUpdates: true,
  promotions: true,
  smsEnabled: false,
};

async function getCurrentUserId(): Promise<string | null> {
  if (IS_MOCK_AUTH) return MOCK_USER_ID;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function activityCopy(status: string): { title: string; description: string } {
  const map: Record<string, { title: string; description: string }> = {
    booked: {
      title: 'Pickup Scheduled',
      description: 'Your pickup has been scheduled successfully.',
    },
    pickup_assigned: {
      title: 'Pickup Assigned',
      description: 'A rider has been assigned for your pickup.',
    },
    pickup_in_progress: {
      title: 'Rider On The Way',
      description: 'Your pickup partner is heading to your address.',
    },
    picked_up: {
      title: 'Pickup Confirmed',
      description: 'Your clothes were picked up successfully.',
    },
    ironing: {
      title: 'Ironing In Progress',
      description: 'Your clothes are being ironed at our facility.',
    },
    out_for_delivery: {
      title: 'Out for Delivery',
      description: 'Your clean clothes are on the way.',
    },
    delivered: {
      title: 'Order Delivered',
      description: 'Your order was delivered successfully.',
    },
    completed: {
      title: 'Order Completed',
      description: 'Your order is complete. Thank you!',
    },
  };

  return (
    map[status] || {
      title: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      description: 'Your order status was updated.',
    }
  );
}

/**
 * Activity feed from order events for the current customer.
 */
export async function getActivityFeed(limit = 30): Promise<ActivityItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data: orders, error: ordersError } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select('id, order_number')
    .eq('customer_id', userId);

  if (ordersError || !orders || orders.length === 0) {
    return [];
  }

  const orderRows = orders as Array<{ id: string; order_number: string }>;
  const orderIds = orderRows.map((o) => o.id);
  const orderMap = Object.fromEntries(
    orderRows.map((o) => [o.id, o.order_number]),
  );

  const { data: events, error } = await (supabase
    .from('order_events') as ReturnType<typeof supabase.from>)
    .select('id, order_id, status, note, metadata, created_at')
    .in('order_id', orderIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[Notifications] Activity error:', error);
    return [];
  }

  return ((events as Array<{
    id: string;
    order_id: string;
    status: string;
    note: string | null;
    metadata: {
      estimated_amount?: number;
      final_amount?: number;
      difference?: number;
      reason_lines?: string[];
    } | null;
    created_at: string;
  }>) || []).map((event) => {
    const copy = activityCopy(event.status);
    let description = event.note || copy.description;

    if (event.status === 'picked_up' && !event.note && event.metadata?.final_amount != null) {
      const finalAmount = Number(event.metadata.final_amount);
      const estimated = event.metadata.estimated_amount;
      if (estimated != null && Number(estimated) !== finalAmount) {
        const diff = Number(event.metadata.difference ?? finalAmount - Number(estimated));
        const diffLabel = diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`;
        const reasons = (event.metadata.reason_lines || [])
          .map((line, i) => `${i + 1}. ${line}`)
          .join('\n');
        description = [
          `Estimated Amount : ₹${estimated}`,
          `Final Amount : ₹${finalAmount}`,
          `Difference : ${diffLabel}`,
          reasons ? `Reason:\n${reasons}` : null,
        ]
          .filter(Boolean)
          .join('\n\n');
      } else {
        description = `Final Amount\n₹${finalAmount}`;
      }
    }

    return {
      id: event.id,
      title: event.status === 'picked_up' ? 'Pickup Confirmed' : copy.title,
      description,
      orderNumber: orderMap[event.order_id] || '',
      status: event.status,
      createdAt: event.created_at,
    };
  });
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
): Promise<void> {
  await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(prefs));
}

export function formatActivityTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
