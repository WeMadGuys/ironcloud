import type { Metadata } from 'next';

import { AdminRootLayoutClient } from './AdminRootLayoutClient';

export const metadata: Metadata = {
  title: {
    absolute: 'Iron Cloud Admin',
  },
  description: 'Iron Cloud operations admin portal',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminRootLayoutClient>{children}</AdminRootLayoutClient>;
}
