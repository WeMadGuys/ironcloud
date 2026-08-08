import { IS_MOCK_AUTH, MOCK_USER_ID } from '../../../config/auth';
import { supabase } from '../../../lib/supabase';
import { createTtlCache } from '../../../lib/ttl-cache';

const ORDERS_CACHE_TTL_MS = 45_000;
const ORDERS_LIST_LIMIT = 40;

export type OrderStatus =
  | 'draft'
  | 'booked'
  | 'pickup_assigned'
  | 'pickup_in_progress'
  | 'picked_up'
  | 'warehouse_received'
  | 'sorting'
  | 'ironing'
  | 'quality_check'
  | 'packed'
  | 'ready_for_delivery'
  | 'delivery_assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'rated'
  | 'cancelled'
  | 'refund_initiated'
  | 'refund_completed';

export type OrderItem = {
  id: string;
  garmentName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  specialInstructions: string | null;
  totalAmount: number;
  itemCount: number;
  bagCount: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  pickupStart: string | null;
  pickupEnd: string | null;
  deliveryStart: string | null;
  deliveryEnd: string | null;
  pickedUpAt: string | null;
};

const ACTIVE_STATUSES: OrderStatus[] = [
  'booked',
  'pickup_assigned',
  'pickup_in_progress',
  'picked_up',
  'warehouse_received',
  'sorting',
  'ironing',
  'quality_check',
  'packed',
  'ready_for_delivery',
  'delivery_assigned',
  'out_for_delivery',
];

/** Delivered and later — shown under Previous Orders. */
const PREVIOUS_STATUSES: OrderStatus[] = [
  'delivered',
  'completed',
  'rated',
  'cancelled',
  'refund_initiated',
  'refund_completed',
];

async function getCurrentUserId(): Promise<string | null> {
  if (IS_MOCK_AUTH) return MOCK_USER_ID;

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) return sessionData.session.user.id;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function mapOrder(row: {
  id: string;
  order_number: string;
  status: OrderStatus;
  special_instructions: string | null;
  total_amount: number;
  created_at: string;
  updated_at: string;
  pickup_slot: { window_start: string; window_end: string } | null;
  delivery_slot: { window_start: string; window_end: string } | null;
  order_items:
    | {
        id: string;
        quantity: number;
        unit_price: number;
        service: { name: string } | null;
      }[]
    | null;
  order_events: { status: OrderStatus; created_at: string }[] | null;
}): Order {
  const items: OrderItem[] = (row.order_items || []).map((item) => {
    const quantity = item.quantity || 0;
    const unitPrice = Number(item.unit_price || 0);
    return {
      id: item.id,
      garmentName: item.service?.name || 'Garment',
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice,
    };
  });

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const pickedUpEvent = (row.order_events || []).find(
    (event) => event.status === 'picked_up',
  );

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    specialInstructions: row.special_instructions,
    totalAmount: Number(row.total_amount || 0),
    itemCount,
    bagCount: itemCount > 0 ? Math.max(1, Math.ceil(itemCount / 8)) : 1,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pickupStart: row.pickup_slot?.window_start ?? null,
    pickupEnd: row.pickup_slot?.window_end ?? null,
    deliveryStart: row.delivery_slot?.window_start ?? null,
    deliveryEnd: row.delivery_slot?.window_end ?? null,
    pickedUpAt: pickedUpEvent?.created_at ?? null,
  };
}

export async function getCustomerOrders(options?: {
  force?: boolean;
}): Promise<{
  activeOrders: Order[];
  previousOrders: Order[];
}> {
  return ordersCache.getOrFetch(async () => {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { activeOrders: [], previousOrders: [] };
    }

    const { data, error } = await (supabase
      .from('orders') as ReturnType<typeof supabase.from>)
      .select(
        `
        id,
        order_number,
        status,
        special_instructions,
        total_amount,
        created_at,
        updated_at,
        pickup_slot:pickup_slot_id (window_start, window_end),
        delivery_slot:delivery_slot_id (window_start, window_end),
        order_items (
          id,
          quantity,
          unit_price,
          service:service_id (name)
        ),
        order_events (status, created_at)
      `,
      )
      .eq('customer_id', userId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(ORDERS_LIST_LIMIT);

    if (error) {
      console.error('Error fetching orders:', error);
      return { activeOrders: [], previousOrders: [] };
    }

    const orders = ((data as Parameters<typeof mapOrder>[0][]) || []).map(mapOrder);

    // Active = not yet delivered. Previous = delivered and beyond (plus cancelled).
    const activeOrders = orders.filter((order) =>
      ACTIVE_STATUSES.includes(order.status),
    );
    const previousOrders = orders.filter((order) =>
      PREVIOUS_STATUSES.includes(order.status),
    );

    return { activeOrders, previousOrders };
  }, options?.force === true);
}

const ordersCache = createTtlCache<{
  activeOrders: Order[];
  previousOrders: Order[];
}>(ORDERS_CACHE_TTL_MS);

export function getCachedCustomerOrders(): {
  activeOrders: Order[];
  previousOrders: Order[];
} | null {
  return ordersCache.get();
}

export function clearOrdersCache(): void {
  ordersCache.clear();
}

/**
 * Single order for the details screen.
 * Prefers the list cache, then fetches by id (own orders only).
 */
export async function getCustomerOrderById(orderId: string): Promise<Order | null> {
  const cached = ordersCache.get();
  if (cached) {
    const hit =
      cached.activeOrders.find((o) => o.id === orderId) ||
      cached.previousOrders.find((o) => o.id === orderId);
    if (hit) return hit;
  }

  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await (supabase
    .from('orders') as ReturnType<typeof supabase.from>)
    .select(
      `
      id,
      order_number,
      status,
      special_instructions,
      total_amount,
      created_at,
      updated_at,
      pickup_slot:pickup_slot_id (window_start, window_end),
      delivery_slot:delivery_slot_id (window_start, window_end),
      order_items (
        id,
        quantity,
        unit_price,
        service:service_id (name)
      ),
      order_events (status, created_at)
    `,
    )
    .eq('id', orderId)
    .eq('customer_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching order:', error);
    return null;
  }
  if (!data) return null;

  return mapOrder(data as Parameters<typeof mapOrder>[0]);
}

export function getStatusLabel(status: OrderStatus): string {
  const labels: Partial<Record<OrderStatus, string>> = {
    booked: 'Booked',
    pickup_assigned: 'Pickup Assigned',
    pickup_in_progress: 'Pickup In Progress',
    picked_up: 'Picked Up',
    warehouse_received: 'At Warehouse',
    sorting: 'Sorting',
    ironing: 'Ironing',
    quality_check: 'Quality Check',
    packed: 'Packed',
    ready_for_delivery: 'Ready for Delivery',
    delivery_assigned: 'Out for Delivery',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    completed: 'Completed',
    rated: 'Completed',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

export function getStatusDescription(status: OrderStatus): string {
  const descriptions: Partial<Record<OrderStatus, string>> = {
    booked: 'Your order is confirmed and scheduled.',
    pickup_assigned: 'A rider is assigned for pickup.',
    pickup_in_progress: 'Rider is on the way to pick up your clothes.',
    picked_up: 'Your clothes are on the way to our laundry.',
    warehouse_received: 'Your clothes have arrived at our facility.',
    sorting: 'Your clothes are being sorted.',
    ironing: 'Your clothes are being ironed.',
    quality_check: 'Quality check is in progress.',
    packed: 'Your clothes are packed and ready.',
    ready_for_delivery: 'Ready for delivery to your door.',
    delivery_assigned: 'A rider is on the way with your clothes.',
    out_for_delivery: 'Your clothes are out for delivery.',
    delivered: 'Your order was delivered successfully.',
    completed: 'Your order is complete.',
    rated: 'Your order is complete.',
  };
  return descriptions[status] || 'Tracking your order.';
}

/** Progress steps shown on current order card */
export type ProgressStep = 'picked_up' | 'ironing' | 'out_for_delivery';

export function getProgressStepIndex(status: OrderStatus): number {
  if (['picked_up', 'warehouse_received', 'sorting'].includes(status)) return 0;
  if (['ironing', 'quality_check', 'packed', 'ready_for_delivery'].includes(status)) {
    return 1;
  }
  if (['delivery_assigned', 'out_for_delivery'].includes(status)) return 2;
  if (['booked', 'pickup_assigned', 'pickup_in_progress'].includes(status)) return -1;
  return 0;
}

export function formatOrderDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function formatOrderDateTime(dateString: string): string {
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart}`;
}

export function formatSlotRange(
  start: string | null,
  end: string | null,
): { dateLabel: string; timeLabel: string } {
  if (!start || !end) {
    return { dateLabel: 'To be scheduled', timeLabel: '—' };
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  const today = new Date();
  const isToday =
    startDate.getDate() === today.getDate() &&
    startDate.getMonth() === today.getMonth() &&
    startDate.getFullYear() === today.getFullYear();

  const dateLabel = isToday
    ? `Today, ${startDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`
    : startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

  const timeLabel = `${startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} - ${endDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })}`;

  return { dateLabel, timeLabel };
}
