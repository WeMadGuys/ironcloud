import dynamic from 'next/dynamic';

import { Loader } from '@/components/Loader/Loader';

const DashboardPage = dynamic(
  () => import('@/features/dashboard/components/DashboardPage').then((m) => m.DashboardPage),
  { loading: () => <Loader fullPage /> },
);

export default function DashboardRoute() {
  return <DashboardPage />;
}
