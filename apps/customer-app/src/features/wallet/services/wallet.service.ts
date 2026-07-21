import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

export type WalletTransaction = {
  id: string;
  type: 'recharge' | 'debit' | 'refund' | 'cashback' | 'expiry';
  amount: number;
  balanceAfter: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
};

export type WalletInfo = {
  id: string;
  balance: number;
};

/**
 * Get wallet info for current user
 */
export async function getWallet(): Promise<WalletInfo | null> {
  const userId = IS_MOCK_AUTH ? MOCK_USER_ID : null;
  
  if (!userId) {
    return null;
  }

  const { data, error } = await (supabase
    .from('wallets') as ReturnType<typeof supabase.from>)
    .select('id, balance')
    .eq('customer_id', userId)
    .single();

  if (error) {
    console.error('Error fetching wallet:', error);
    return null;
  }

  return {
    id: (data as { id: string }).id,
    balance: Number((data as { balance: number }).balance),
  };
}

/**
 * Get wallet transactions for current user
 */
export async function getWalletTransactions(limit = 20): Promise<WalletTransaction[]> {
  const userId = IS_MOCK_AUTH ? MOCK_USER_ID : null;
  
  if (!userId) {
    return [];
  }

  // First get the wallet ID
  const { data: wallet } = await (supabase
    .from('wallets') as ReturnType<typeof supabase.from>)
    .select('id')
    .eq('customer_id', userId)
    .single();

  if (!wallet) {
    return [];
  }

  const walletId = (wallet as { id: string }).id;

  const { data, error } = await (supabase
    .from('wallet_transactions') as ReturnType<typeof supabase.from>)
    .select('id, type, amount, balance_after, description, order_id, created_at')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return ((data as Array<{
    id: string;
    type: WalletTransaction['type'];
    amount: number;
    balance_after: number;
    description: string | null;
    order_id: string | null;
    created_at: string;
  }>) || []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    amount: Math.abs(Number(tx.amount)),
    balanceAfter: Number(tx.balance_after),
    description: tx.description,
    orderId: tx.order_id,
    createdAt: tx.created_at,
  }));
}

/**
 * Format date for display
 */
export function formatTransactionDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
}
