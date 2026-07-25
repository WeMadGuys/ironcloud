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

function mapAddressRow(row: {
  id: string;
  community_id: string;
  tower: string | null;
  flat_number: string;
  is_default: boolean;
  community: { name: string; city: string } | null;
}): CustomerAddress {
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

const ADDRESS_SELECT = `
  id,
  community_id,
  tower,
  flat_number,
  is_default,
  community:community_id (name, city)
`;

/** All addresses for the customer (prefer default first). */
export async function listAddresses(): Promise<CustomerAddress[]> {
  const userId = await getCurrentUserId();

  const { data, error } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .select(ADDRESS_SELECT)
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
  }>) || []).map(mapAddressRow);
}

/** Single address for the customer (default, else most recent). */
export async function getCustomerAddress(): Promise<CustomerAddress | null> {
  const addresses = await listAddresses();
  if (addresses.length === 0) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}

/**
 * Create or update the customer's one address.
 * Always marked default — one user, one address.
 */
export async function saveCustomerAddress(input: {
  communityId: string;
  tower?: string;
  flatNumber: string;
}): Promise<CustomerAddress> {
  const userId = await getCurrentUserId();
  const existing = await getCustomerAddress();

  const payload = {
    community_id: input.communityId,
    tower: input.tower?.trim() || null,
    flat_number: input.flatNumber.trim(),
    is_default: true,
  };

  if (existing) {
    const { data, error } = await (supabase
      .from('addresses') as ReturnType<typeof supabase.from>)
      .update(payload)
      .eq('id', existing.id)
      .eq('customer_id', userId)
      .select(ADDRESS_SELECT)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to update address');
    }

    return mapAddressRow(
      data as {
        id: string;
        community_id: string;
        tower: string | null;
        flat_number: string;
        is_default: boolean;
        community: { name: string; city: string } | null;
      },
    );
  }

  const { data, error } = await (supabase
    .from('addresses') as ReturnType<typeof supabase.from>)
    .insert({
      customer_id: userId,
      ...payload,
    })
    .select(ADDRESS_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save address');
  }

  return mapAddressRow(
    data as {
      id: string;
      community_id: string;
      tower: string | null;
      flat_number: string;
      is_default: boolean;
      community: { name: string; city: string } | null;
    },
  );
}

/** @deprecated Use saveCustomerAddress — one address per customer. */
export async function addAddress(input: {
  communityId: string;
  tower?: string;
  flatNumber: string;
  makeDefault?: boolean;
}): Promise<CustomerAddress> {
  return saveCustomerAddress({
    communityId: input.communityId,
    tower: input.tower,
    flatNumber: input.flatNumber,
  });
}

/** @deprecated Not needed with a single address model. */
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
