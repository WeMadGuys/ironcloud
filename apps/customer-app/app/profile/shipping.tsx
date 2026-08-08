import {
  LEGAL_LAST_UPDATED,
  SHIPPING_POLICY_SECTIONS,
  SHIPPING_POLICY_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocumentScreen } from '../../src/features/legal/components/LegalDocumentScreen';

export default function ShippingScreen() {
  return (
    <LegalDocumentScreen
      title={SHIPPING_POLICY_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={SHIPPING_POLICY_SECTIONS}
    />
  );
}
