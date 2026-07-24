import { getSupabase } from '@/lib/supabase';

export const fetchWallets = async (page = 1, pageSize = 25, search?: string) => {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('wallets')
    .select('*, profiles!wallets_customer_id_fkey(full_name, phone)', { count: 'exact' });

  const { data, count } = await query.order('balance', { ascending: false }).range(from, to);
  return { data: data ?? [], total: count ?? 0 };
};

export const fetchWalletTransactions = async (walletId: string, page = 1, pageSize = 25) => {
  const supabase = getSupabase();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count } = await supabase
    .from('wallet_transactions')
    .select('*', { count: 'exact' })
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .range(from, to);

  return { data: data ?? [], total: count ?? 0 };
};

export const fetchTotalWalletBalance = async () => {
  const supabase = getSupabase();
  const { data } = await supabase.from('wallets').select('balance');
  return (data ?? []).reduce((s, w) => s + Number(w.balance ?? 0), 0);
};
