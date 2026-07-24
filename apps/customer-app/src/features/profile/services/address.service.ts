import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

export type CustomerAddress = {
  id: string;
  communityId: string;
  communityName: string;
  city: string;
  tower: string | null;
  flatNumber: string;
  isDefault: boolean;
};

async function getCurrentUserId(): Promise<string> {
  if (IS_MOCK_AUTH) return MOCK_USER_ID;

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;
  if (sessionUserId) return sessionUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  return user.id;
}

export async function listAddresses(): Promise<CustomerAddress[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .select(
      `
      id,
      community_id,
      tower,
      flat_number,
      is_default,
      community:community_id (name, city)
    `,
    )
    .eq('customer_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Address] List error:', error);
    return [];
  }

  return ((data as Array<{
    id: string;
    community_id: string;
    tower: string | null;
    flat_number: string;
    is_default: boolean;
    community: { name: string; city: string } | null;
  }>) || []).map((row) => ({
    id: row.id,
    communityId: row.community_id,
    communityName: row.community?.name || 'Community',
    city: row.community?.city || '',
    tower: row.tower,
    flatNumber: row.flat_number,
    isDefault: !!row.is_default,
  }));
}

export async function addAddress(input: {
  communityId: string;
  tower?: string;
  flatNumber: string;
  makeDefault?: boolean;
}): Promise<CustomerAddress> {
  const userId = await getCurrentUserId();
  const existing = await listAddresses();
  const makeDefault = input.makeDefault ?? existing.length === 0;

  if (makeDefault && existing.length > 0) {
    await (supabase.from('addresses') as ReturnType<typeof supabase.from>)
      .update({ is_default: false })
      .eq('customer_id', userId);
  }

  const { data, error } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .insert({
      customer_id: userId,
      community_id: input.communityId,
      tower: input.tower?.trim() || null,
      flat_number: input.flatNumber.trim(),
      is_default: makeDefault,
    })
    .select(
      `
      id,
      community_id,
      tower,
      flat_number,
      is_default,
      community:community_id (name, city)
    `,
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to add address');
  }

  const row = data as {
    id: string;
    community_id: string;
    tower: string | null;
    flat_number: string;
    is_default: boolean;
    community: { name: string; city: string } | null;
  };

  return {
    id: row.id,
    communityId: row.community_id,
    communityName: row.community?.name || 'Community',
    city: row.community?.city || '',
    tower: row.tower,
    flatNumber: row.flat_number,
    isDefault: !!row.is_default,
  };
}

export async function setDefaultAddress(addressId: string): Promise<void> {
  const userId = await getCurrentUserId();

  await (supabase.from('addresses') as ReturnType<typeof supabase.from>)
    .update({ is_default: false })
    .eq('customer_id', userId);

  const { error } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .update({ is_default: true })
    .eq('id', addressId)
    .eq('customer_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
