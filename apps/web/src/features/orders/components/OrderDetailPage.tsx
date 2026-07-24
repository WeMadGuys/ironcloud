'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge, Button, Card, Loader } from '@/components';
import { trpc } from '@/lib/trpc';
import type { OrderStatus } from '@ironcloud/db';
import { formatCurrency, formatOrderStatus, formatRelativeTime, getOrderStatusBadge } from '@/utils/format';

import { fetchOrderById, fetchOrderEvents } from '../services/orders.service';

import pageStyles from '@/styles/pages.module.css';
import detailStyles from './OrderDetailPage.module.css';

export const OrderDetailPage = () => {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Awaited<ReturnType<typeof fetchOrderById>>['data']>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof fetchOrderEvents>>>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  const addNoteMutation = trpc.orders.addNote.useMutation();
  const cancelMutation = trpc.orders.cancel.useMutation();
  const updateStatusMutation = trpc.orders.updateStatus.useMutation();

  const load = async () => {
    setLoading(true);
    const [orderRes, eventsRes] = await Promise.all([
      fetchOrderById(orderId),
      fetchOrderEvents(orderId),
    ]);
    setOrder(orderRes.data);
    setEvents(eventsRes);
    setLoading(false);
  };

  useEffect(() => { load(); }, [orderId]);

  if (loading) return <Loader fullPage />;
  if (!order) return <div>Order not found</div>;

  const customer = order.profiles as { full_name: string; phone: string } | null;
  const community = order.communities as { name: string; city: string } | null;
  const address = order.addresses as { flat_number: string; tower: string } | null;

  return (
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
            <textarea
              className={detailStyles.noteInput}
              rows={3}
              placeholder="Add admin note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              onClick={() => addNoteMutation.mutate({ orderId, note }, { onSuccess: () => { setNote(''); load(); } })}
              disabled={!note}
            >
              Add Note
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate({ orderId, reason: 'Admin cancelled' }, { onSuccess: load })}
            >
              Cancel Order
            </Button>
            {order.status === 'booked' && (
              <Button
                variant="secondary"
                onClick={() => updateStatusMutation.mutate({ orderId, status: 'pickup_assigned' as OrderStatus }, { onSuccess: load })}
              >
                Assign Pickup
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
