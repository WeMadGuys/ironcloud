import { AUTH_PROVIDER } from '../../../config/auth';
import { getApiBaseUrl } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

export type DeliveryQuote = {
  totalAmount: number;
  walletBalance: number;
  paymentStatus: 'paid' | 'unpaid';
  pending: {
    id: string;
    walletAmount: number;
    qrAmount: number;
    qrImageUrl: string | null;
  } | null;
};

export type DeliveryCollectionResult = {
  paid: boolean;
  status: 'pending_qr' | 'paid' | 'cancelled' | 'expired';
  collectionId: string;
  totalAmount: number;
  walletAmount: number;
  qrAmount: number;
  qrImageUrl: string | null;
  paymentStatus: 'paid' | 'unpaid';
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asMoney(value: unknown): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function asStatus(value: unknown): DeliveryCollectionResult['status'] {
  if (
    value === 'pending_qr' ||
    value === 'paid' ||
    value === 'cancelled' ||
    value === 'expired'
  ) {
    return value;
  }
  return 'pending_qr';
}

function parseCollection(value: unknown): DeliveryCollectionResult {
  const row = asRecord(value);
  if (!row) throw new Error('Payment response was empty.');
  return {
    paid: row.paid === true,
    status: asStatus(row.status),
    collectionId: typeof row.collectionId === 'string' ? row.collectionId : '',
    totalAmount: asMoney(row.totalAmount),
    walletAmount: asMoney(row.walletAmount),
    qrAmount: asMoney(row.qrAmount),
    qrImageUrl: typeof row.qrImageUrl === 'string' ? row.qrImageUrl : null,
    paymentStatus: row.paymentStatus === 'paid' || row.paid === true ? 'paid' : 'unpaid',
  };
}

async function post(path: string, body: Record<string, unknown>): Promise<unknown> {
  if (AUTH_PROVIDER === 'mock') {
    throw new Error('Scanner payment needs a signed-in rider session.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Session expired. Please sign in again and retry.');
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the payment server. Check the connection and try again.');
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'Payment request failed.');
  }
  return payload;
}

export async function quoteDeliveryPayment(orderId: string): Promise<DeliveryQuote> {
  const payload = asRecord(
    await post('/api/booking/delivery-payment/quote', { orderId }),
  );
  if (!payload) throw new Error('Payment quote was empty.');
  const pending = asRecord(payload.pending);
  return {
    totalAmount: asMoney(payload.totalAmount),
    walletBalance: asMoney(payload.walletBalance),
    paymentStatus: payload.paymentStatus === 'paid' ? 'paid' : 'unpaid',
    pending: pending
      ? {
          id: typeof pending.id === 'string' ? pending.id : '',
          walletAmount: asMoney(pending.walletAmount),
          qrAmount: asMoney(pending.qrAmount),
          qrImageUrl: typeof pending.qrImageUrl === 'string' ? pending.qrImageUrl : null,
        }
      : null,
  };
}

export async function startDeliveryPayment(
  orderId: string,
  useWallet: boolean,
  useScanner: boolean,
): Promise<DeliveryCollectionResult> {
  return parseCollection(
    await post('/api/booking/delivery-payment/start', { orderId, useWallet, useScanner }),
  );
}

export async function pollDeliveryPayment(
  orderId: string,
  collectionId: string,
): Promise<DeliveryCollectionResult> {
  return parseCollection(
    await post('/api/booking/delivery-payment/status', { orderId, collectionId }),
  );
}

export async function cancelDeliveryPayment(
  orderId: string,
  collectionId: string,
): Promise<DeliveryCollectionResult> {
  return parseCollection(
    await post('/api/booking/delivery-payment/cancel', { orderId, collectionId }),
  );
}
