import type { OrderStatus } from '@ironcloud/db';
import type { BadgeVariant } from '@ironcloud/ui';

const STATUS_MAP: Partial<Record<OrderStatus, BadgeVariant>> = {
  booked: 'pendingPickup',
  pickup_assigned: 'pendingPickup',
  pickup_in_progress: 'pendingPickup',
  picked_up: 'pickedUp',
  ironing: 'ironing',
  sorting: 'ironing',
  quality_check: 'ironing',
  out_for_delivery: 'outForDelivery',
  delivery_assigned: 'outForDelivery',
  delivered: 'delivered',
  completed: 'delivered',
  rated: 'delivered',
  cancelled: 'cancelled',
  refund_initiated: 'error',
  refund_completed: 'cancelled',
};

export const getOrderStatusBadge = (status: OrderStatus): BadgeVariant =>
  STATUS_MAP[status] ?? 'default';

export const formatOrderStatus = (status: string): string =>
  status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

export const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const startOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const toISODate = (date: Date): string => date.toISOString().split('T')[0];
