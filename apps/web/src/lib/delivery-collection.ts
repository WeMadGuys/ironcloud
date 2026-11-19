import type { SupabaseClient } from '@supabase/supabase-js';

import type { PaymentMethod } from '@ironcloud/db';

import { getRazorpayClient, getRazorpayEnv } from '@/lib/razorpay';

type Admin = SupabaseClient<any>;

const QR_TTL_MS = 15 * 60 * 1000;

export type CollectionStatus = 'pending_qr' | 'paid' | 'cancelled' | 'expired';

type CollectionRow = {
  id: string;
  order_id: string;
  rider_id: string;
  total_amount: number;
  wallet_amount: number;
  qr_amount: number;
  status: CollectionStatus;
  razorpay_qr_id: string | null;
  razorpay_payment_id: string | null;
  wallet_transaction_id: string | null;
  created_at: string;
  paid_at: string | null;
  closed_at: string | null;
};

type OrderRow = {
  id: string;
  customer_id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  status: string;
};

type QrPayment = { id: string; amount: number; status: string };

type QrRecord = {
  id: string;
  image_url?: string;
  status?: string;
};

export class DeliveryPaymentError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DeliveryPaymentError';
    this.status = status;
    this.details = details;
  }
}

export function money(value: unknown): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function toPaise(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

function rupeeLabel(amount: number): string {
  const rounded = money(amount);
  return Number.isInteger(rounded) ? `₹${rounded}` : `₹${rounded.toFixed(2)}`;
}

/** Wallet takes min(balance, total) when selected. Scanner is whatever is left. */
export function splitDeliveryAmount(
  total: number,
  balance: number,
  useWallet: boolean,
): { walletAmount: number; qrAmount: number } {
  const safeTotal = money(Math.max(total, 0));
  const safeBalance = money(Math.max(balance, 0));
  const walletAmount = useWallet ? money(Math.min(safeBalance, safeTotal)) : 0;
  return { walletAmount, qrAmount: money(safeTotal - walletAmount) };
}

function paymentMethodFor(row: Pick<CollectionRow, 'wallet_amount' | 'qr_amount'>): PaymentMethod {
  const wallet = toPaise(row.wallet_amount) > 0;
  const qr = toPaise(row.qr_amount) > 0;
  if (wallet && qr) return 'split';
  if (qr) return 'razorpay_direct';
  return 'wallet';
}

function walletDebitDescription(collectionId: string): string {
  return `Order payment for delivery (wallet portion) [${collectionId}]`;
}

function errorText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === 'object') {
    const record = err as {
      message?: string;
      description?: string;
      error?: { description?: string };
    };
    return record.error?.description || record.description || record.message || 'Payment request failed.';
  }
  return 'Payment request failed.';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function qrApi() {
  const client = getRazorpayClient() as unknown as {
    qrCode: {
      create(body: Record<string, unknown>): Promise<QrRecord>;
      fetch(id: string): Promise<QrRecord>;
      close(id: string): Promise<QrRecord>;
      fetchAllPayments(id: string): Promise<{ items?: QrPayment[] }>;
    };
  };
  return client.qrCode;
}

async function refundRazorpayPayment(paymentId: string, amountPaise: number): Promise<void> {
  const client = getRazorpayClient() as unknown as {
    payments: { refund(id: string, body: { amount: number }): Promise<unknown> };
  };
  try {
    await client.payments.refund(paymentId, { amount: amountPaise });
  } catch (err) {
    const message = errorText(err);
    if (/already been refunded|fully refunded/i.test(message)) return;
    throw err;
  }
}

async function closeQr(qrId: string): Promise<void> {
  try {
    await qrApi().close(qrId);
  } catch (err) {
    const message = errorText(err);
    if (/already closed|cannot be closed/i.test(message)) return;
    throw err;
  }
}

function mapRow(value: unknown): CollectionRow {
  const row = asRecord(value);
  if (!row || typeof row.id !== 'string' || typeof row.order_id !== 'string') {
    throw new DeliveryPaymentError('Delivery collection could not be read.', 500);
  }
  const status = row.status;
  if (
    status !== 'pending_qr' &&
    status !== 'paid' &&
    status !== 'cancelled' &&
    status !== 'expired'
  ) {
    throw new DeliveryPaymentError('Delivery collection has an unknown status.', 500);
  }
  return {
    id: row.id,
    order_id: row.order_id,
    rider_id: typeof row.rider_id === 'string' ? row.rider_id : '',
    total_amount: money(row.total_amount),
    wallet_amount: money(row.wallet_amount),
    qr_amount: money(row.qr_amount),
    status,
    razorpay_qr_id: typeof row.razorpay_qr_id === 'string' ? row.razorpay_qr_id : null,
    razorpay_payment_id: typeof row.razorpay_payment_id === 'string' ? row.razorpay_payment_id : null,
    wallet_transaction_id:
      typeof row.wallet_transaction_id === 'string' ? row.wallet_transaction_id : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    paid_at: typeof row.paid_at === 'string' ? row.paid_at : null,
    closed_at: typeof row.closed_at === 'string' ? row.closed_at : null,
  };
}

async function assertDeliveryRider(admin: Admin, riderId: string, orderId: string): Promise<void> {
  const { data, error } = await admin
    .from('rider_jobs')
    .select('id')
    .eq('order_id', orderId)
    .eq('rider_id', riderId)
    .eq('job_type', 'delivery')
    .maybeSingle();
  if (error) throw new DeliveryPaymentError(error.message, 500);
  if (!data) throw new DeliveryPaymentError('Not authorized for this delivery.', 403);
}

async function loadOrder(admin: Admin, orderId: string): Promise<OrderRow> {
  const { data, error } = await admin
    .from('orders')
    .select('id, customer_id, order_number, total_amount, payment_status, status')
    .eq('id', orderId)
    .single();
  if (error || !data) throw new DeliveryPaymentError('Order not found.', 404);
  const row = asRecord(data);
  if (!row || typeof row.id !== 'string' || typeof row.customer_id !== 'string') {
    throw new DeliveryPaymentError('Order not found.', 404);
  }
  return {
    id: row.id,
    customer_id: row.customer_id,
    order_number: typeof row.order_number === 'string' ? row.order_number : '',
    total_amount: money(row.total_amount),
    payment_status: typeof row.payment_status === 'string' ? row.payment_status : 'unpaid',
    status: typeof row.status === 'string' ? row.status : '',
  };
}

async function readWalletBalance(admin: Admin, customerId: string): Promise<number> {
  const { data, error } = await admin
    .from('wallets')
    .select('balance')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw new DeliveryPaymentError(error.message, 500);
  return money(asRecord(data)?.balance ?? 0);
}

async function findPending(admin: Admin, orderId: string): Promise<CollectionRow | null> {
  const { data, error } = await admin
    .from('delivery_collections')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'pending_qr')
    .maybeSingle();
  if (error) throw new DeliveryPaymentError(error.message, 500);
  return data ? mapRow(data) : null;
}

async function findPaid(admin: Admin, orderId: string): Promise<CollectionRow | null> {
  const { data, error } = await admin
    .from('delivery_collections')
    .select('*')
    .eq('order_id', orderId)
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new DeliveryPaymentError(error.message, 500);
  return data ? mapRow(data) : null;
}

async function getCollection(admin: Admin, collectionId: string): Promise<CollectionRow> {
  const { data, error } = await admin
    .from('delivery_collections')
    .select('*')
    .eq('id', collectionId)
    .single();
  if (error || !data) throw new DeliveryPaymentError('Delivery collection not found.', 404);
  return mapRow(data);
}

async function findByQrId(admin: Admin, qrId: string): Promise<CollectionRow | null> {
  const { data, error } = await admin
    .from('delivery_collections')
    .select('*')
    .eq('razorpay_qr_id', qrId)
    .maybeSingle();
  if (error) throw new DeliveryPaymentError(error.message, 500);
  return data ? mapRow(data) : null;
}

async function ensureOrderPaid(admin: Admin, row: CollectionRow): Promise<void> {
  const { error } = await admin
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_method: paymentMethodFor(row),
    })
    .eq('id', row.order_id);
  if (!error) return;

  const { error: statusError } = await admin
    .from('orders')
    .update({ payment_status: 'paid' })
    .eq('id', row.order_id);
  if (statusError) throw new DeliveryPaymentError(error.message, 500);
  console.error('[delivery-collection] payment method', error.message);
}

async function applyDelta(
  admin: Admin,
  customerId: string,
  amount: number,
  direction: 'debit' | 'refund',
  orderId: string,
  description: string,
): Promise<{ transactionId: string }> {
  const { data, error } = await admin.rpc('apply_customer_wallet_delta', {
    p_customer_id: customerId,
    p_amount: money(amount),
    p_direction: direction,
    p_order_id: orderId,
    p_description: description,
  });
  if (error) {
    const message = error.message || 'Wallet update failed.';
    if (message.includes('insufficient_balance')) {
      throw new DeliveryPaymentError('Customer wallet balance changed. Choose again.', 409);
    }
    if (message.includes('wallet_not_found')) {
      throw new DeliveryPaymentError('Customer wallet was not found.', 409);
    }
    throw new DeliveryPaymentError(message, 500);
  }
  const record = asRecord(data);
  const transactionId = record?.transaction_id;
  if (typeof transactionId !== 'string') {
    throw new DeliveryPaymentError('Wallet update did not return a transaction.', 500);
  }
  return { transactionId };
}

async function closeCollection(
  admin: Admin,
  collectionId: string,
  status: 'paid' | 'cancelled' | 'expired',
  razorpayPaymentId: string | null,
): Promise<{ changed: boolean; status: string }> {
  const { data, error } = await admin.rpc('close_delivery_collection', {
    p_collection_id: collectionId,
    p_status: status,
    p_razorpay_payment_id: razorpayPaymentId,
  });
  if (error) throw new DeliveryPaymentError(error.message, 500);
  const record = asRecord(data);
  return {
    changed: record?.changed === true,
    status: typeof record?.status === 'string' ? record.status : status,
  };
}

async function refundDuplicateDebit(
  admin: Admin,
  customerId: string,
  orderId: string,
  debitId: string,
  amount: number,
): Promise<void> {
  const marker = `Duplicate delivery wallet debit reversed (${debitId})`;
  const { data, error } = await admin
    .from('wallet_transactions')
    .select('id')
    .eq('order_id', orderId)
    .eq('type', 'refund')
    .eq('description', marker)
    .maybeSingle();
  if (error) throw new DeliveryPaymentError(error.message, 500);
  if (data) return;
  await applyDelta(admin, customerId, amount, 'refund', orderId, marker);
}

/**
 * Debits the wallet portion once. A second caller that also debits refunds its own row.
 */
async function ensureWalletDebited(
  admin: Admin,
  row: CollectionRow,
  customerId: string,
): Promise<CollectionRow> {
  if (toPaise(row.wallet_amount) <= 0) return row;
  if (row.wallet_transaction_id) return row;

  const description = walletDebitDescription(row.id);
  const { data: existing, error: existingError } = await admin
    .from('wallet_transactions')
    .select('id')
    .eq('order_id', row.order_id)
    .eq('type', 'debit')
    .eq('description', description)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new DeliveryPaymentError(existingError.message, 500);

  const existingId = asRecord(existing)?.id;
  let transactionId: string;
  let createdHere = false;
  if (typeof existingId === 'string') {
    transactionId = existingId;
  } else {
    const debit = await applyDelta(
      admin,
      customerId,
      row.wallet_amount,
      'debit',
      row.order_id,
      description,
    );
    transactionId = debit.transactionId;
    createdHere = true;
  }

  const { data: saved, error: saveError } = await admin
    .from('delivery_collections')
    .update({ wallet_transaction_id: transactionId })
    .eq('id', row.id)
    .is('wallet_transaction_id', null)
    .select('wallet_transaction_id')
    .maybeSingle();
  if (saveError) {
    if (createdHere) {
      await refundDuplicateDebit(admin, customerId, row.order_id, transactionId, row.wallet_amount);
    }
    throw new DeliveryPaymentError(saveError.message, 500);
  }

  if (!saved) {
    const fresh = await getCollection(admin, row.id);
    if (fresh.wallet_transaction_id === transactionId) return fresh;
    if (createdHere) {
      await refundDuplicateDebit(admin, customerId, row.order_id, transactionId, row.wallet_amount);
    }
    if (fresh.wallet_transaction_id) return fresh;
    throw new DeliveryPaymentError('Could not store the wallet debit.', 500);
  }

  return { ...row, wallet_transaction_id: transactionId };
}

async function deleteUntouched(admin: Admin, collectionId: string): Promise<void> {
  await admin
    .from('delivery_collections')
    .delete()
    .eq('id', collectionId)
    .eq('status', 'pending_qr')
    .is('wallet_transaction_id', null)
    .is('razorpay_qr_id', null);
}

function viewOf(
  row: CollectionRow,
  paid: boolean,
  qrImageUrl: string | null,
): CollectionView {
  return {
    paid,
    status: row.status,
    collectionId: row.id,
    totalAmount: row.total_amount,
    walletAmount: row.wallet_amount,
    qrAmount: row.qr_amount,
    qrImageUrl,
    paymentStatus: paid ? 'paid' : 'unpaid',
  };
}

export type CollectionView = {
  paid: boolean;
  status: CollectionStatus;
  collectionId: string;
  totalAmount: number;
  walletAmount: number;
  qrAmount: number;
  qrImageUrl: string | null;
  paymentStatus: 'paid' | 'unpaid';
};

async function markPaidFromQr(
  admin: Admin,
  row: CollectionRow,
  paymentId: string,
  imageUrl: string | null,
): Promise<CollectionView> {
  const closed = await closeCollection(admin, row.id, 'paid', paymentId);
  if (!closed.changed) {
    const fresh = await getCollection(admin, row.id);
    if (fresh.status === 'paid') {
      await ensureOrderPaid(admin, fresh);
      if (fresh.razorpay_payment_id && fresh.razorpay_payment_id !== paymentId) {
        await refundRazorpayPayment(paymentId, toPaise(row.qr_amount));
      }
      return viewOf(fresh, true, imageUrl);
    }
    await refundRazorpayPayment(paymentId, toPaise(row.qr_amount));
    return viewOf(fresh, false, null);
  }
  const paidRow: CollectionRow = { ...row, status: 'paid', razorpay_payment_id: paymentId };
  await ensureOrderPaid(admin, paidRow);
  return viewOf(paidRow, true, imageUrl);
}

async function capturedPayments(qrId: string, expectedPaise: number): Promise<{
  match: QrPayment | null;
  imageUrl: string | null;
  qrStatus: string;
}> {
  const qr = await qrApi().fetch(qrId);
  const page = await qrApi().fetchAllPayments(qrId);
  const captured = (page.items ?? []).filter((item) => item.status === 'captured' && item.id);
  const match = captured.find((item) => Number(item.amount) === expectedPaise) ?? null;
  for (const other of captured) {
    if (other.id !== match?.id) {
      await refundRazorpayPayment(other.id, Number(other.amount));
    }
  }
  return {
    match,
    imageUrl: qr.image_url ?? null,
    qrStatus: qr.status ?? 'active',
  };
}

async function syncOpenQr(admin: Admin, row: CollectionRow): Promise<CollectionView> {
  if (!row.razorpay_qr_id) return viewOf(row, false, null);

  let fetched: { match: QrPayment | null; imageUrl: string | null; qrStatus: string };
  try {
    fetched = await capturedPayments(row.razorpay_qr_id, toPaise(row.qr_amount));
  } catch (err) {
    console.error('[delivery-collection] qr sync', err);
    return viewOf(row, false, null);
  }

  if (fetched.match) {
    return markPaidFromQr(admin, row, fetched.match.id, fetched.imageUrl);
  }

  const ageMs = Date.now() - new Date(row.created_at).getTime();
  const expired = fetched.qrStatus === 'closed' || ageMs > QR_TTL_MS;
  if (!expired) return viewOf(row, false, fetched.imageUrl);

  if (fetched.qrStatus !== 'closed') {
    try {
      await closeQr(row.razorpay_qr_id);
    } catch (err) {
      console.error('[delivery-collection] close expired qr', err);
    }
    try {
      const again = await capturedPayments(row.razorpay_qr_id, toPaise(row.qr_amount));
      if (again.match) return markPaidFromQr(admin, row, again.match.id, again.imageUrl);
    } catch (err) {
      console.error('[delivery-collection] recheck expired qr', err);
    }
  }

  const closed = await closeCollection(admin, row.id, 'expired', null);
  if (!closed.changed && closed.status === 'paid') {
    const fresh = await getCollection(admin, row.id);
    await ensureOrderPaid(admin, fresh);
    return viewOf(fresh, true, fetched.imageUrl);
  }
  const fresh = await getCollection(admin, row.id);
  return viewOf(fresh, fresh.status === 'paid', null);
}

async function createQr(order: OrderRow, row: CollectionRow): Promise<QrRecord> {
  const env = getRazorpayEnv();
  if (env.missing.length) {
    throw new DeliveryPaymentError(`Missing env: ${env.missing.join(', ')}`, 500);
  }
  const name = `Skribll ${order.order_number}`.trim().slice(0, 40) || 'Skribll delivery';
  return qrApi().create({
    type: 'upi_qr',
    name,
    usage: 'single_use',
    fixed_amount: true,
    payment_amount: toPaise(row.qr_amount),
    description: `Delivery ${order.order_number}`.slice(0, 255),
    close_by: Math.floor(Date.now() / 1000) + 15 * 60,
    notes: {
      purpose: 'delivery_collection',
      collection_id: row.id,
      order_id: order.id,
      customer_id: order.customer_id,
    },
  });
}

async function finishWalletOnly(admin: Admin, row: CollectionRow): Promise<CollectionView> {
  const closed = await closeCollection(admin, row.id, 'paid', null);
  if (!closed.changed && closed.status !== 'paid') {
    const fresh = await getCollection(admin, row.id);
    if (fresh.status !== 'paid') return viewOf(fresh, false, null);
    await ensureOrderPaid(admin, fresh);
    return viewOf(fresh, true, null);
  }
  const paidRow: CollectionRow = { ...row, status: 'paid' };
  await ensureOrderPaid(admin, paidRow);
  return viewOf(paidRow, true, null);
}

async function continueCollection(
  admin: Admin,
  order: OrderRow,
  row: CollectionRow,
): Promise<CollectionView> {
  if (row.status === 'paid') {
    await ensureOrderPaid(admin, row);
    return viewOf(row, true, null);
  }
  if (row.status !== 'pending_qr') return viewOf(row, false, null);

  const debited =
    toPaise(row.wallet_amount) > 0 ? await ensureWalletDebited(admin, row, order.customer_id) : row;

  if (toPaise(debited.qr_amount) <= 0) {
    return finishWalletOnly(admin, debited);
  }
  if (debited.razorpay_qr_id) return syncOpenQr(admin, debited);

  let qr: QrRecord;
  try {
    qr = await createQr(order, debited);
  } catch (err) {
    await closeCollection(admin, debited.id, 'cancelled', null);
    if (err instanceof DeliveryPaymentError) throw err;
    throw new DeliveryPaymentError(errorText(err), 502);
  }

  const { data: saved, error } = await admin
    .from('delivery_collections')
    .update({ razorpay_qr_id: qr.id })
    .eq('id', debited.id)
    .eq('status', 'pending_qr')
    .is('razorpay_qr_id', null)
    .select('id')
    .maybeSingle();
  if (error) {
    try {
      await closeQr(qr.id);
    } catch (closeErr) {
      console.error('[delivery-collection] close unsaved qr', closeErr);
    }
    await closeCollection(admin, debited.id, 'cancelled', null);
    throw new DeliveryPaymentError(error.message, 500);
  }
  if (!saved) {
    try {
      await closeQr(qr.id);
    } catch (closeErr) {
      console.error('[delivery-collection] close duplicate qr', closeErr);
    }
    const fresh = await getCollection(admin, debited.id);
    if (fresh.razorpay_qr_id) return syncOpenQr(admin, fresh);
    throw new DeliveryPaymentError('Could not store the scanner.', 500);
  }

  return viewOf({ ...debited, razorpay_qr_id: qr.id }, false, qr.image_url ?? null);
}

async function insertPending(
  admin: Admin,
  order: OrderRow,
  riderId: string,
  walletAmount: number,
  qrAmount: number,
): Promise<{ row: CollectionRow; created: boolean }> {
  const { data, error } = await admin
    .from('delivery_collections')
    .insert({
      order_id: order.id,
      rider_id: riderId,
      total_amount: order.total_amount,
      wallet_amount: walletAmount,
      qr_amount: qrAmount,
      status: 'pending_qr',
    })
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505' || /duplicate key|delivery_collections_one_open/i.test(error.message)) {
      const pending = await findPending(admin, order.id);
      if (pending) return { row: pending, created: false };
    }
    throw new DeliveryPaymentError(error.message, 500);
  }
  return { row: mapRow(data), created: true };
}

function paidPayload(row: CollectionRow, alreadyPaid: boolean): CollectionView & { alreadyPaid: boolean } {
  return { ...viewOf(row, true, null), alreadyPaid };
}

export async function quoteDeliveryPayment(admin: Admin, riderId: string, orderId: string) {
  await assertDeliveryRider(admin, riderId, orderId);
  const order = await loadOrder(admin, orderId);
  const walletBalance = await readWalletBalance(admin, order.customer_id);
  const paid = await findPaid(admin, orderId);
  if (paid || order.payment_status === 'paid') {
    if (paid) await ensureOrderPaid(admin, paid);
    return {
      totalAmount: order.total_amount,
      walletBalance,
      paymentStatus: 'paid' as const,
      pending: null,
    };
  }

  const pending = await findPending(admin, orderId);
  let qrImageUrl: string | null = null;
  if (pending?.razorpay_qr_id) {
    try {
      const qr = await qrApi().fetch(pending.razorpay_qr_id);
      qrImageUrl = qr.image_url ?? null;
    } catch (err) {
      console.error('[delivery-collection] quote qr image', err);
    }
  }

  return {
    totalAmount: order.total_amount,
    walletBalance,
    paymentStatus: 'unpaid' as const,
    pending: pending
      ? {
          id: pending.id,
          walletAmount: pending.wallet_amount,
          qrAmount: pending.qr_amount,
          qrImageUrl,
        }
      : null,
  };
}

export async function startDeliveryPayment(
  admin: Admin,
  riderId: string,
  orderId: string,
  useWallet: boolean,
  useScanner: boolean,
): Promise<CollectionView & { alreadyPaid?: boolean }> {
  await assertDeliveryRider(admin, riderId, orderId);
  const order = await loadOrder(admin, orderId);
  if (order.status === 'cancelled') {
    throw new DeliveryPaymentError('This order is cancelled.', 409);
  }

  const paid = await findPaid(admin, orderId);
  if (paid) {
    await ensureOrderPaid(admin, paid);
    return paidPayload(paid, true);
  }
  if (order.payment_status === 'paid') {
    return {
      paid: true,
      alreadyPaid: true,
      status: 'paid',
      collectionId: '',
      totalAmount: order.total_amount,
      walletAmount: 0,
      qrAmount: 0,
      qrImageUrl: null,
      paymentStatus: 'paid',
    };
  }
  if (toPaise(order.total_amount) <= 0) {
    const { error } = await admin
      .from('orders')
      .update({ payment_status: 'paid', payment_method: 'wallet' })
      .eq('id', order.id);
    if (error) throw new DeliveryPaymentError(error.message, 500);
    return {
      paid: true,
      status: 'paid',
      collectionId: '',
      totalAmount: 0,
      walletAmount: 0,
      qrAmount: 0,
      qrImageUrl: null,
      paymentStatus: 'paid',
    };
  }

  const pending = await findPending(admin, orderId);
  if (pending) return continueCollection(admin, order, pending);

  if (!useWallet && !useScanner) {
    throw new DeliveryPaymentError('Select wallet, scanner, or both.', 400);
  }

  const balance = await readWalletBalance(admin, order.customer_id);
  const split = splitDeliveryAmount(order.total_amount, balance, useWallet);
  if (split.qrAmount > 0 && split.qrAmount < 1) {
    throw new DeliveryPaymentError('Scanner amount must be at least ₹1.', 422);
  }
  if (split.qrAmount > 0 && !useScanner) {
    throw new DeliveryPaymentError(
      `Select scanner for the remaining ${rupeeLabel(split.qrAmount)}.`,
      422,
      { remainder: split.qrAmount, walletBalance: balance, totalAmount: order.total_amount },
    );
  }
  if (split.qrAmount >= 1 && getRazorpayEnv().missing.length) {
    const missing = getRazorpayEnv().missing.join(', ');
    throw new DeliveryPaymentError(`Missing env: ${missing}`, 500);
  }

  const inserted = await insertPending(admin, order, riderId, split.walletAmount, split.qrAmount);
  if (!inserted.created) return continueCollection(admin, order, inserted.row);

  try {
    return await continueCollection(admin, order, inserted.row);
  } catch (err) {
    await deleteUntouched(admin, inserted.row.id);
    throw err;
  }
}

async function ownedCollection(
  admin: Admin,
  riderId: string,
  orderId: string,
  collectionId: string,
): Promise<{ order: OrderRow; row: CollectionRow }> {
  await assertDeliveryRider(admin, riderId, orderId);
  const order = await loadOrder(admin, orderId);
  const row = await getCollection(admin, collectionId);
  if (row.order_id !== orderId) {
    throw new DeliveryPaymentError('That payment does not belong to this order.', 404);
  }
  return { order, row };
}

export async function statusDeliveryPayment(
  admin: Admin,
  riderId: string,
  orderId: string,
  collectionId: string,
): Promise<CollectionView> {
  const { row } = await ownedCollection(admin, riderId, orderId, collectionId);
  if (row.status === 'paid') {
    await ensureOrderPaid(admin, row);
    return viewOf(row, true, null);
  }
  if (row.status !== 'pending_qr') return viewOf(row, false, null);
  if (toPaise(row.qr_amount) <= 0) {
    if (!row.wallet_transaction_id) return viewOf(row, false, null);
    return finishWalletOnly(admin, row);
  }
  if (!row.razorpay_qr_id) return viewOf(row, false, null);
  return syncOpenQr(admin, row);
}

export async function cancelDeliveryPayment(
  admin: Admin,
  riderId: string,
  orderId: string,
  collectionId: string,
): Promise<CollectionView> {
  const { row } = await ownedCollection(admin, riderId, orderId, collectionId);
  if (row.status === 'paid') {
    await ensureOrderPaid(admin, row);
    return viewOf(row, true, null);
  }
  if (row.status !== 'pending_qr') return viewOf(row, false, null);

  if (row.razorpay_qr_id) {
    try {
      const fetched = await capturedPayments(row.razorpay_qr_id, toPaise(row.qr_amount));
      if (fetched.match) {
        return markPaidFromQr(admin, row, fetched.match.id, fetched.imageUrl);
      }
      await closeQr(row.razorpay_qr_id);
    } catch (err) {
      throw new DeliveryPaymentError(
        `Could not close the scanner. ${errorText(err)}`,
        502,
      );
    }
  }

  const closed = await closeCollection(admin, row.id, 'cancelled', null);
  if (!closed.changed && closed.status === 'paid') {
    const fresh = await getCollection(admin, row.id);
    await ensureOrderPaid(admin, fresh);
    return viewOf(fresh, true, null);
  }
  const fresh = await getCollection(admin, row.id);
  return viewOf(fresh, fresh.status === 'paid', null);
}

/** Webhook and late QR credits. Never credits the Skribll wallet. */
export async function settleDeliveryQrPayment(
  admin: Admin,
  input: { qrId: string; paymentId: string; amountPaise: number },
): Promise<{ ignored?: boolean; refunded?: boolean }> {
  const row = await findByQrId(admin, input.qrId);
  if (!row) return { ignored: true };
  if (input.amountPaise !== toPaise(row.qr_amount)) {
    await refundRazorpayPayment(input.paymentId, input.amountPaise);
    return { refunded: true };
  }
  await markPaidFromQr(admin, row, input.paymentId, null);
  return {};
}

async function netWalletCollected(admin: Admin, orderId: string): Promise<number> {
  const { data, error } = await admin
    .from('wallet_transactions')
    .select('amount, type')
    .eq('order_id', orderId)
    .in('type', ['debit', 'refund']);
  if (error) throw new DeliveryPaymentError(error.message, 500);
  let net = 0;
  for (const item of data ?? []) {
    const row = asRecord(item);
    const amount = money(row?.amount);
    if (row?.type === 'debit') net += Math.abs(amount);
    if (row?.type === 'refund') net -= Math.abs(amount);
  }
  return money(net);
}

/**
 * The old full-debit route must not treat a partial delivery debit as fully paid,
 * and must not run while a scanner session is open.
 */
export async function legacyDeliveryDebitGuard(
  admin: Admin,
  orderId: string,
  totalAmount: number,
): Promise<{ action: 'proceed' } | { action: 'already_paid' } | { action: 'blocked'; error: string }> {
  const pending = await findPending(admin, orderId);
  if (pending) {
    return { action: 'blocked', error: 'A delivery payment is already in progress.' };
  }
  const paid = await findPaid(admin, orderId);
  if (paid) return { action: 'already_paid' };
  const net = await netWalletCollected(admin, orderId);
  if (toPaise(net) >= toPaise(totalAmount)) return { action: 'already_paid' };
  if (toPaise(net) > 0) {
    return {
      action: 'blocked',
      error: 'This order has a partial wallet payment. Finish it from the delivery payment screen.',
    };
  }
  return { action: 'proceed' };
}
