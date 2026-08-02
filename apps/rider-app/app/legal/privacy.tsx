import {
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocumentScreen } from '../../src/features/legal/components/LegalDocumentScreen';

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      title={PRIVACY_POLICY_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={PRIVACY_POLICY_SECTIONS}
    />
  );
}
