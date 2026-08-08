import {
  APP_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocument } from '@/components/landing';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: PRIVACY_POLICY_TITLE,
  description: `Privacy Policy for ${APP_LEGAL_NAME} customer and rider apps.`,
  path: '/privacy-policy',
});

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title={PRIVACY_POLICY_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={PRIVACY_POLICY_SECTIONS}
      relatedLinks={[
        { href: '/terms-and-conditions', label: 'Terms of Service' },
        { href: '/refund-policy', label: 'Cancellation & Refund Policy' },
        { href: '/shipping-policy', label: 'Shipping & Delivery Policy' },
      ]}
    />
  );
}
