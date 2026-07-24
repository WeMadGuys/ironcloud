'use client';

import { useEffect } from 'react';

import { getSupabase } from '@/lib/supabase';

export const useOrderRealtime = (onUpdate: () => void) => {
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel('admin-orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
};
