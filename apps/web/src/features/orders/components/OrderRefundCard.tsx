'use client';

import { useMemo, useState } from 'react';

import { Button, Card } from '@/components';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime } from '@/utils/format';

import type { OrderRefundRecord } from '../services/orders.service';

import detailStyles from './OrderDetailPage.module.css';

type RefundItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type RefundMode = 'items' | 'custom';

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function formatRefundMoney(amount: number): string {
  const rounded = roundMoney(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

function serviceName(services: unknown): string {
  const row = Array.isArray(services) ? services[0] : services;
  if (!row || typeof row !== 'object') return 'Item';
  const name = (row as { name?: unknown }).name;
  return typeof name === 'string' && name.trim() ? name.trim() : 'Item';
}

function toRefundItems(raw: unknown): RefundItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as {
      id?: unknown;
      quantity?: unknown;
      unit_price?: unknown;
      services?: unknown;
    };
    if (typeof item.id !== 'string') return [];
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unit_price ?? 0);
    return [{
      id: item.id,
      name: serviceName(item.services),
      quantity: Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0,
      unitPrice: Number.isFinite(unitPrice) ? roundMoney(unitPrice) : 0,
    }];
  });
}

export function OrderRefundCard({
  orderId,
  orderNumber,
  customerName,
  paymentStatus,
  totalAmount,
  debitedAmount,
  items,
  refunds,
  loadError,
  onRefunded,
}: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  paymentStatus: string | null;
  totalAmount: number;
  debitedAmount: number;
  items: unknown;
  refunds: OrderRefundRecord[];
  loadError: string | null;
  onRefunded: () => void;
}) {
  const [mode, setMode] = useState<RefundMode>('items');
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [customAmount, setCustomAmount] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const refundMutation = trpc.orders.refund.useMutation();

  const garmentItems = useMemo(() => toRefundItems(items), [items]);
  const refundedQtyByItem = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const refund of refunds) {
      for (const line of refund.lines) {
        totals[line.order_item_id] = (totals[line.order_item_id] ?? 0) + line.quantity;
      }
    }
    return totals;
  }, [refunds]);

  const isPaid = paymentStatus === 'paid';
  const paid = debitedAmount > 0
    ? debitedAmount
    : isPaid
      ? roundMoney(totalAmount)
      : 0;
  const alreadyRefunded = roundMoney(refunds.reduce((sum, refund) => sum + refund.amount, 0));
  const refundable = roundMoney(Math.max(0, paid - alreadyRefunded));

  const selected = garmentItems.flatMap((item) => {
    const remainingQty = Math.max(0, item.quantity - (refundedQtyByItem[item.id] ?? 0));
    const quantity = Math.min(remainingQty, qtyByItem[item.id] ?? 0);
    if (quantity <= 0) return [];
    return [{
      ...item,
      quantity,
      lineAmount: roundMoney(quantity * item.unitPrice),
    }];
  });

  const parsedCustom = roundMoney(Number(customAmount));
  const thisRefund = mode === 'items'
    ? roundMoney(selected.reduce((sum, line) => sum + line.lineAmount, 0))
    : Number.isFinite(parsedCustom) && parsedCustom > 0
      ? parsedCustom
      : 0;
  const exceeds = thisRefund > refundable;
  const remainingAfter = roundMoney(Math.max(0, refundable - (exceeds ? 0 : thisRefund)));
  const canSubmit = isPaid && refundable > 0 && thisRefund > 0 && !exceeds && !refundMutation.isPending;
  const itemDetail = selected.map((line) => `${line.name} × ${line.quantity}`).join(', ');
  const walletMessage = mode === 'items'
    ? (itemDetail ? `Refund for order ${orderNumber}: ${itemDetail}` : '')
    : (thisRefund > 0 ? `Refund for order ${orderNumber}` : '');

  const switchMode = (next: RefundMode) => {
    setMode(next);
    if (next === 'items') setCustomAmount('');
    else setQtyByItem({});
  };

  const setQty = (itemId: string, next: number, max: number) => {
    setQtyByItem((current) => ({
      ...current,
      [itemId]: Math.min(max, Math.max(0, next)),
    }));
  };

  const submit = () => {
    if (!canSubmit) return;
    const who = customerName.trim() || 'the customer';
    const confirmed = window.confirm(
      mode === 'items'
        ? `Refund ${formatRefundMoney(thisRefund)} to ${who} for ${itemDetail}?`
        : `Refund ${formatRefundMoney(thisRefund)} to ${who}?`,
    );
    if (!confirmed) return;

    refundMutation.mutate(
      mode === 'items'
        ? {
          kind: 'items',
          orderId,
          idempotencyKey,
          lines: selected.map((line) => ({
            orderItemId: line.id,
            quantity: line.quantity,
          })),
        }
        : {
          kind: 'custom',
          orderId,
          idempotencyKey,
          amount: thisRefund,
        },
      {
        onSuccess: () => {
          setQtyByItem({});
          setCustomAmount('');
          setIdempotencyKey(crypto.randomUUID());
          onRefunded();
        },
        onError: (err) => {
          window.alert(err.message || 'Refund failed');
        },
      },
    );
  };

  return (
    <Card title="Refund" className={detailStyles.refundCard}>
      {loadError && <p className={detailStyles.refundError}>{loadError}</p>}
      {!isPaid && (
        <p className={detailStyles.refundNote}>
          Refunds are available after this order is paid from the customer wallet.
        </p>
      )}
      {isPaid && refundable <= 0 && (
        <p className={detailStyles.refundNote}>Nothing left to refund.</p>
      )}

      <div className={detailStyles.modeToggle} role="group" aria-label="Refund type">
        <Button
          className={detailStyles.modeButton}
          variant={mode === 'items' ? 'primary' : 'secondary'}
          onClick={() => switchMode('items')}
          disabled={!isPaid || refundable <= 0}
          aria-pressed={mode === 'items'}
        >
          Items
        </Button>
        <Button
          className={detailStyles.modeButton}
          variant={mode === 'custom' ? 'primary' : 'secondary'}
          onClick={() => switchMode('custom')}
          disabled={!isPaid || refundable <= 0}
          aria-pressed={mode === 'custom'}
        >
          Custom amount
        </Button>
      </div>

      {mode === 'items' ? (
        garmentItems.length === 0 ? (
          <p className={detailStyles.refundNote}>No garments on this order.</p>
        ) : (
          <div>
            {garmentItems.map((item) => {
              const refundedQty = refundedQtyByItem[item.id] ?? 0;
              const remainingQty = Math.max(0, item.quantity - refundedQty);
              const selectedQty = Math.min(remainingQty, qtyByItem[item.id] ?? 0);
              return (
                <div key={item.id} className={detailStyles.refundLine}>
                  <div className={detailStyles.refundLineMeta}>
                    <span className={detailStyles.refundLineName}>{item.name}</span>
                    <span className={detailStyles.refundLineDetail}>
                      {formatRefundMoney(item.unitPrice)} · ordered {item.quantity} · refunded {refundedQty}
                    </span>
                  </div>
                  {remainingQty === 0 ? (
                    <span className={detailStyles.refundLineDetail}>Fully refunded</span>
                  ) : (
                    <div className={detailStyles.stepper}>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Remove one ${item.name}`}
                        disabled={!isPaid || refundable <= 0 || selectedQty <= 0}
                        onClick={() => setQty(item.id, selectedQty - 1, remainingQty)}
                      >
                        −
                      </Button>
                      <span className={detailStyles.stepperQty}>{selectedQty}</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Refund one more ${item.name}`}
                        disabled={!isPaid || refundable <= 0 || selectedQty >= remainingQty}
                        onClick={() => setQty(item.id, selectedQty + 1, remainingQty)}
                      >
                        +
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : (
        <input
          className={detailStyles.noteInput}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          placeholder="Custom refund amount"
          aria-label="Custom refund amount"
          value={customAmount}
          disabled={!isPaid || refundable <= 0}
          onChange={(event) => setCustomAmount(event.target.value)}
        />
      )}

      <div className={detailStyles.refundSummary}>
        <span>Paid <strong>{formatRefundMoney(paid)}</strong></span>
        <span>Already refunded <strong>{formatRefundMoney(alreadyRefunded)}</strong></span>
        <span>This refund <strong>{formatRefundMoney(thisRefund)}</strong></span>
        <span>Remaining <strong>{formatRefundMoney(exceeds ? refundable : remainingAfter)}</strong></span>
      </div>

      {exceeds && (
        <p className={detailStyles.refundError}>Refund exceeds the remaining paid amount.</p>
      )}
      {walletMessage && (
        <p className={detailStyles.refundMessage}>{walletMessage}</p>
      )}

      <Button onClick={submit} disabled={!canSubmit} fullWidth>
        {refundMutation.isPending ? 'Refunding…' : `Refund ${formatRefundMoney(thisRefund)}`}
      </Button>

      {refunds.length > 0 && (
        <div>
          <p className={detailStyles.refundHistoryLabel}>Previous refunds</p>
          <ul className={detailStyles.refundHistory}>
            {refunds.map((refund) => (
              <li key={refund.id} className={detailStyles.refundHistoryItem}>
                <span>{refund.description}</span>
                <span>
                  {formatRefundMoney(refund.amount)} · {formatRelativeTime(refund.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
