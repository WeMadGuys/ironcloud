'use client';

import { useQuery } from '@tanstack/react-query';

import { isAdminRole } from '@/config/auth';
import type { UserRole } from '@ironcloud/db';
import { getSupabase } from '@/lib/supabase';

import { useAuth } from './useAuth';

type AdminRoleState = {
  role: UserRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  profile: {
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  } | null;
};

type AdminProfileRow = {
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

/**
 * Shared across AdminShell / Sidebar / TopNav via React Query — one profile fetch
 * per session window instead of three independent requests on every mount.
 */
export const useAdminRole = (): AdminRoleState => {
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading: profileLoading } = useQuery({
    queryKey: ['admin-profile', user?.id ?? null],
    enabled: Boolean(user?.id) && !authLoading,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AdminProfileRow | null> => {
      if (!user?.id) return null;
      const supabase = getSupabase();
      const { data: row } = await supabase
        .from('profiles')
        .select('role, full_name, phone, avatar_url')
        .eq('id', user.id)
        .single();
      if (!row) return null;
      return row as AdminProfileRow;
    },
  });

  const role = data?.role ?? null;

  return {
    role,
    isAdmin: role ? isAdminRole(role) : false,
    isLoading: authLoading || (Boolean(user) && profileLoading),
    profile: data
      ? {
          full_name: data.full_name,
          phone: data.phone,
          avatar_url: data.avatar_url,
        }
      : null,
  };
};
