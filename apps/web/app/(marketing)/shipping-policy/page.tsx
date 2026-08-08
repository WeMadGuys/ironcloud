import {
  APP_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  SHIPPING_POLICY_SECTIONS,
  SHIPPING_POLICY_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocument } from '@/components/landing';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: SHIPPING_POLICY_TITLE,
  description: `Shipping and delivery policy for ${APP_LEGAL_NAME} doorstep pickup and ironing return delivery.`,
  path: '/shipping-policy',
});

export default function ShippingPolicyPage() {
  return (
    <LegalDocument
      title={SHIPPING_POLICY_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={SHIPPING_POLICY_SECTIONS}
      relatedLinks={[
        { href: '/refund-policy', label: 'Cancellation & Refund Policy' },
        { href: '/terms-and-conditions', label: 'Terms of Service' },
        { href: '/privacy-policy', label: 'Privacy Policy' },
      ]}
    />
  );
}
