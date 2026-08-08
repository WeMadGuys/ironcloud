import {
  LEGAL_LAST_UPDATED,
  REFUND_POLICY_SECTIONS,
  REFUND_POLICY_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocumentScreen } from '../../src/features/legal/components/LegalDocumentScreen';

export default function RefundScreen() {
  return (
    <LegalDocumentScreen
      title={REFUND_POLICY_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={REFUND_POLICY_SECTIONS}
    />
  );
}
