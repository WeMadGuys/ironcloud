'use client';

import { usePathname } from 'next/navigation';

import { Providers } from '@/components/Providers';
import { useAdminRole } from '@/features/auth/hooks/useAdminRole';
import { AdminLayout } from '@/layouts/AdminLayout';
import { Loader } from '@/components/Loader/Loader';
import { ADMIN_ROUTES } from '@/constants/routes';

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  [ADMIN_ROUTES.dashboard]: { title: 'Dashboard', subtitle: 'Overview of Iron Cloud operations' },
  [ADMIN_ROUTES.orders]: { title: 'Orders', subtitle: 'Manage and track all orders' },
  [ADMIN_ROUTES.customers]: { title: 'Customers', subtitle: 'Customer profiles and activity' },
  [ADMIN_ROUTES.communities]: { title: 'Communities', subtitle: 'Community management and analytics' },
  [ADMIN_ROUTES.partners]: { title: 'Partners', subtitle: 'Partner performance and verification' },
  [ADMIN_ROUTES.riders]: { title: 'Riders', subtitle: 'Live rider status and assignments' },
  [ADMIN_ROUTES.boxes]: { title: 'Boxes', subtitle: 'Physical box inventory and QR codes' },
  [ADMIN_ROUTES.wallet]: { title: 'Wallet', subtitle: 'Wallet balances and transactions' },
  [ADMIN_ROUTES.finance]: { title: 'Finance', subtitle: 'Revenue, settlements, and invoices' },
  [ADMIN_ROUTES.promotions]: { title: 'Promotions', subtitle: 'Coupons, campaigns, and banners' },
  [ADMIN_ROUTES.analytics]: { title: 'Analytics', subtitle: 'Business intelligence and metrics' },
  [ADMIN_ROUTES.support]: { title: 'Customer Support', subtitle: 'Open and resolved customer requests' },
  [ADMIN_ROUTES.settings]: { title: 'Settings', subtitle: 'System configuration and audit logs' },
};

const getPageMeta = (pathname: string) => {
  const base = Object.keys(PAGE_META).find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  return base ? PAGE_META[base] : { title: 'Admin', subtitle: undefined };
};

export function AdminRootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <AdminShell>{children}</AdminShell>
    </Providers>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useAdminRole();

  if (pathname === ADMIN_ROUTES.login) {
    return <>{children}</>;
  }

  if (isLoading) return <Loader />;

  const meta = getPageMeta(pathname);

  return (
    <AdminLayout title={meta.title} subtitle={meta.subtitle}>
      {children}
    </AdminLayout>
  );
}
