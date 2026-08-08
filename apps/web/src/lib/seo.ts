import type { Metadata } from 'next';

import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SUPPORT_EMAIL,
  SUPPORT_PHONE_TEL,
} from '@/constants/marketing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ironcloud.co.in';

export function createPageMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = '/',
  absolute = false,
}: {
  title: string;
  description?: string;
  path?: string;
  absolute?: boolean;
}): Metadata {
  const url = `${SITE_URL}${path}`;
  const displayTitle = absolute ? title : title;

  return {
    title: absolute ? { absolute: displayTitle } : displayTitle,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: absolute ? displayTitle : `${displayTitle} · ${SITE_NAME}`,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title: absolute ? displayTitle : `${displayTitle} · ${SITE_NAME}`,
      description,
    },
  };
}

export function getLocalBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: SITE_NAME,
    description: `${SITE_TAGLINE}. ${SITE_DESCRIPTION}`,
    url: SITE_URL,
    email: SUPPORT_EMAIL,
    telephone: SUPPORT_PHONE_TEL,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '607, Block D, Avantika Espino, Ameenpur Road',
      addressLocality: 'Ameenpur, Hyderabad',
      addressRegion: 'Telangana',
      postalCode: '502032',
      addressCountry: 'IN',
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
    serviceType: 'Laundry ironing pickup and delivery',
  };
}
