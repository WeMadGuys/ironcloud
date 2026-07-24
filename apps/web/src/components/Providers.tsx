'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, type ReactNode } from 'react';
import superjson from 'superjson';

import { trpc } from '@/lib/trpc';
import { getSupabase } from '@/lib/supabase';

import { ToastProvider } from '@/components/Toast/ToastProvider';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { DateFilterProvider } from '@/contexts/DateFilterContext';
import { SidebarProvider } from '@/contexts/SidebarContext';

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '';
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
};

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          async headers() {
            const supabase = getSupabase();
            const { data } = await supabase.auth.getSession();
            const token = data.session?.access_token;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <DateFilterProvider>
            <SidebarProvider>
              <ToastProvider>{children}</ToastProvider>
            </SidebarProvider>
          </DateFilterProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
};
