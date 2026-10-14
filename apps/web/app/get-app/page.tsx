import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';

import { GetAppView } from '@/components/landing/GetAppView';
import { APP_STORE_URL, GET_APP_PATH, PLAY_STORE_URL } from '@/constants/marketing';
import { recordAppDownloadEvent } from '@/lib/app-download-events';
import { createPageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export const metadata = createPageMetadata({
  title: 'Get the App',
  description: 'Download the Iron Cloud app on the App Store or Google Play.',
  path: GET_APP_PATH,
});

export default async function GetAppPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string | string[] }>;
}) {
  const userAgent = (await headers()).get('user-agent') ?? '';
  const { src } = await searchParams;
  const source = typeof src === 'string' ? src : null;

  const platform = /iPhone|iPad|iPod/i.test(userAgent)
    ? 'ios'
    : /Android/i.test(userAgent)
      ? 'android'
      : null;

  if (platform) {
    after(() => recordAppDownloadEvent({ eventType: 'visit', platform, source }));
    redirect(platform === 'ios' ? APP_STORE_URL : PLAY_STORE_URL);
  }

  // Desktop visits (and iPadOS, which reports a Mac UA) are logged client-side.
  return <GetAppView source={source} />;
}
