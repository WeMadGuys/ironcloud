import {
  APP_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  TERMS_SECTIONS,
  TERMS_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocument } from '@/components/landing';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: TERMS_TITLE,
  description: `Terms of Service for ${APP_LEGAL_NAME} customer and rider apps.`,
  path: '/terms-and-conditions',
});

export default function TermsAndConditionsPage() {
  return (
    <LegalDocument
      title={TERMS_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={TERMS_SECTIONS}
      relatedLinks={[
        { href: '/privacy-policy', label: 'Privacy Policy' },
        { href: '/refund-policy', label: 'Cancellation & Refund Policy' },
        { href: '/shipping-policy', label: 'Shipping & Delivery Policy' },
      ]}
    />
  );
}
