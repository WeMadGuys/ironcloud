'use client';

import { useEffect, useState } from 'react';

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

export const useAdminRole = (): AdminRoleState => {
  const { user, isLoading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<AdminRoleState['profile']>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRole(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabase();
    supabase
      .from('profiles')
      .select('role, full_name, phone, avatar_url')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setRole((data?.role as UserRole) ?? null);
        setProfile(data ? {
          full_name: data.full_name,
          phone: data.phone,
          avatar_url: data.avatar_url,
        } : null);
        setIsLoading(false);
      });
  }, [user, authLoading]);

  return {
    role,
    isAdmin: role ? isAdminRole(role) : false,
    isLoading: authLoading || isLoading,
    profile,
  };
};
