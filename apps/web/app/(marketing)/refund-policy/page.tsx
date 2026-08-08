import {
  APP_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  REFUND_POLICY_SECTIONS,
  REFUND_POLICY_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocument } from '@/components/landing';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: REFUND_POLICY_TITLE,
  description: `Refund Policy for ${APP_LEGAL_NAME} orders, cancellations, and wallet adjustments.`,
  path: '/refund-policy',
});

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      title={REFUND_POLICY_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={REFUND_POLICY_SECTIONS}
      relatedLinks={[
        { href: '/shipping-policy', label: 'Shipping & Delivery Policy' },
        { href: '/privacy-policy', label: 'Privacy Policy' },
        { href: '/terms-and-conditions', label: 'Terms of Service' },
      ]}
    />
  );
}
