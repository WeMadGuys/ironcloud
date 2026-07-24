import dynamic from 'next/dynamic';

import { Loader } from '@/components/Loader/Loader';

const AnalyticsPage = dynamic(
  () => import('@/features/analytics/components/AnalyticsPage').then((m) => m.AnalyticsPage),
  { loading: () => <Loader fullPage /> },
);

export default function AnalyticsRoute() {
  return <AnalyticsPage />;
}
