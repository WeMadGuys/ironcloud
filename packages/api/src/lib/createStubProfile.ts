import type { TypedSupabaseClient, UserRole } from '@ironcloud/db';

const digitsOnly = (phone: string) => phone.replace(/\D/g, '').slice(-10);

/**
 * Creates a stub auth.users row + updates the auto-created profiles row.
 * Does not wire phone OTP identity — app login remains unavailable until auth is set up.
 * Note: handle_new_user trigger inserts profiles as role=customer on auth insert.
 */
export const createStubProfileUser = async (
  supabase: TypedSupabaseClient,
  params: {
    fullName: string;
    phone: string;
    role: Extract<UserRole, 'customer' | 'rider'>;
    email?: string | null;
  },
): Promise<{ id: string }> => {
  const phone = digitsOnly(params.phone);
  if (phone.length !== 10) {
    throw new Error('Phone must be a 10-digit mobile number');
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    throw new Error('A profile with this phone number already exists');
  }

  const id = crypto.randomUUID();
  const stubEmail = params.email?.trim() || `ops.${phone}@ironcloud.dev`;

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    id,
    email: stubEmail,
    email_confirm: true,
    user_metadata: {
      phone,
      full_name: params.fullName,
      role: params.role,
      created_by: 'admin_portal',
    },
  });

  if (authError) {
    if (/already|exists|registered/i.test(authError.message)) {
      throw new Error('A user with this email or phone already exists');
    }
    throw new Error(authError.message);
  }

  const userId = authUser.user?.id ?? id;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      role: params.role,
      full_name: params.fullName.trim(),
      phone,
      email: params.email?.trim() || null,
    })
    .eq('id', userId);

  if (profileError) {
    await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
    if (profileError.code === '23505') {
      throw new Error('A profile with this phone number already exists');
    }
    throw new Error(profileError.message);
  }

  return { id: userId };
};
