'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge, Button, Card, DetailBackLink, Loader } from '@/components';
import { ADMIN_ROUTES } from '@/constants/routes';
import { trpc } from '@/lib/trpc';
import type { OrderStatus } from '@ironcloud/db';
import { formatCurrency, formatOrderStatus, formatRelativeTime, getOrderStatusBadge } from '@/utils/format';

import { fetchOrderById, fetchOrderEvents } from '../services/orders.service';

import pageStyles from '@/styles/pages.module.css';
import detailStyles from './OrderDetailPage.module.css';

const STATUS_OPTIONS: OrderStatus[] = [
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
  'delivered',
  'completed',
  'cancelled',
];

export const OrderDetailPage = () => {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Awaited<ReturnType<typeof fetchOrderById>>['data']>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof fetchOrderEvents>>>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');

  const addNoteMutation = trpc.orders.addNote.useMutation();
  const cancelMutation = trpc.orders.cancel.useMutation();
  const updateStatusMutation = trpc.orders.updateStatus.useMutation();
  const advanceDeliveryMutation = trpc.orders.advanceDeliveryDay.useMutation();

  const load = async () => {
    setLoading(true);
    const [orderRes, eventsRes] = await Promise.all([
      fetchOrderById(orderId),
      fetchOrderEvents(orderId),
    ]);
    setOrder(orderRes.data);
    setEvents(eventsRes);
    if (orderRes.data?.status) {
      setSelectedStatus(orderRes.data.status);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  if (loading) return <Loader fullPage />;
  if (!order) {
    return (
      <div>
        <DetailBackLink href={ADMIN_ROUTES.orders} label="Back to Orders" />
        <div>Order not found</div>
      </div>
    );
  }

  const customer = order.profiles as { full_name: string; phone: string } | null;
  const community = order.communities as { name: string; city: string } | null;
  const address = order.addresses as { flat_number: string; tower: string } | null;

  const statusUnchanged = !selectedStatus || selectedStatus === order.status;
  const statusUpdating = updateStatusMutation.isPending;

  const handleUpdateStatus = () => {
    if (!selectedStatus || selectedStatus === order.status) return;
    updateStatusMutation.mutate(
      {
        orderId,
        status: selectedStatus,
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          setNote('');
          load();
        },
      },
    );
  };

  return (
    <div>
      <DetailBackLink href={ADMIN_ROUTES.orders} label="Back to Orders" />
      <div className={pageStyles.detailGrid}>
        <div>
          <Card title={`Order ${order.order_number}`}>
            <div className={detailStyles.statusRow}>
              <Badge variant={getOrderStatusBadge(order.status)}>{formatOrderStatus(order.status)}</Badge>
              <span>{formatCurrency(Number(order.total_amount))}</span>
            </div>
            <p><strong>Customer:</strong> {customer?.full_name} ({customer?.phone})</p>
            <p><strong>Community:</strong> {community?.name}, {community?.city}</p>
            <p><strong>Address:</strong> {address?.tower} - {address?.flat_number}</p>
            <p><strong>Payment:</strong> {order.payment_method}</p>
            {order.special_instructions && <p><strong>Instructions:</strong> {order.special_instructions}</p>}
            {order.admin_notes && <p><strong>Admin Notes:</strong> {order.admin_notes}</p>}
          </Card>

          <Card title="Timeline">
            <ul className={pageStyles.timeline}>
              {events.map((e) => (
                <li key={e.id} className={pageStyles.timelineItem}>
                  <Badge variant={getOrderStatusBadge(e.status)}>{formatOrderStatus(e.status)}</Badge>
                  {e.note && <p>{e.note}</p>}
                  <div className={pageStyles.timelineTime}>{formatRelativeTime(e.created_at)}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <Card title="Actions">
            <div className={detailStyles.actions}>
              <div className={detailStyles.statusControl}>
                <label htmlFor="order-status" className={detailStyles.statusLabel}>
                  Update status
                </label>
                <select
                  id="order-status"
                  className={pageStyles.select}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  aria-label="Select order status"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {formatOrderStatus(status)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  onClick={handleUpdateStatus}
                  disabled={statusUnchanged || statusUpdating}
                >
                  {statusUpdating ? 'Updating…' : 'Update Status'}
                </Button>
              </div>

              <textarea
                className={detailStyles.noteInput}
                rows={3}
                placeholder="Add admin note (optional for status update)..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                onClick={() => addNoteMutation.mutate({ orderId, note }, { onSuccess: () => { setNote(''); load(); } })}
                disabled={!note || addNoteMutation.isPending}
              >
                Add Note
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  advanceDeliveryMutation.mutate(undefined, {
                    onSuccess: (res) => {
                      window.alert(
                        res.advanced > 0
                          ? `Advanced ${res.advanced} order(s) to out for delivery.`
                          : 'No orders were eligible to advance.',
                      );
                      load();
                    },
                    onError: (err) => {
                      window.alert(err.message || 'Failed to advance delivery day orders.');
                    },
                  })
                }
                disabled={advanceDeliveryMutation.isPending}
              >
                {advanceDeliveryMutation.isPending
                  ? 'Running…'
                  : 'Run delivery day advance'}
              </Button>
              <Button
                variant="danger"
                onClick={() => cancelMutation.mutate({ orderId, reason: 'Admin cancelled' }, { onSuccess: load })}
                disabled={cancelMutation.isPending || order.status === 'cancelled'}
              >
                Cancel Order
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
