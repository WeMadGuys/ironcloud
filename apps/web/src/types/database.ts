import type { Database } from '@ironcloud/db';
import type { SupabaseClient } from '@supabase/supabase-js';

export type TypedClient = SupabaseClient<Database>;

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type OrderRow = Database['public']['Tables']['orders']['Row'];
export type CommunityRow = Database['public']['Tables']['communities']['Row'];
export type PartnerRow = Database['public']['Tables']['partners']['Row'];
export type WalletRow = Database['public']['Tables']['wallets']['Row'];
