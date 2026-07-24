import { getSupabase } from '@/lib/supabase';
import { endOfDay, startOfDay } from '@/utils/format';

export const fetchFinanceOverview = async (date: Date) => {
  const supabase = getSupabase();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const [orders, settlements, invoices, refunds] = await Promise.all([
    supabase.from('orders').select('total_amount, subtotal').gte('created_at', dayStart).lte('created_at', dayEnd),
    supabase.from('settlements').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('invoices').select('*').order('issued_at', { ascending: false }).limit(20),
    supabase.from('orders').select('total_amount').in('status', ['refund_initiated', 'refund_completed']),
  ]);

  const revenue = (orders.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const gstTotal = (invoices.data ?? []).reduce((s, i) => s + Number(i.gst_amount ?? 0), 0);
  const refundTotal = (refunds.data ?? []).reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  return {
    revenue,
    gstTotal,
    refundTotal,
    settlements: settlements.data ?? [],
    invoices: invoices.data ?? [],
  };
};

export const exportOrdersCSV = async (date: Date): Promise<string> => {
  const supabase = getSupabase();
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = endOfDay(date).toISOString();

  const { data } = await supabase
    .from('orders')
    .select('order_number, status, total_amount, created_at')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  const header = 'Order Number,Status,Amount,Created At\n';
  const rows = (data ?? [])
    .map((o) => `${o.order_number},${o.status},${o.total_amount},${o.created_at}`)
    .join('\n');

  return header + rows;
};
