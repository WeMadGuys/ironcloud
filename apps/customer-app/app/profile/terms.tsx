import {
  LEGAL_LAST_UPDATED,
  TERMS_SECTIONS,
  TERMS_TITLE,
} from '@ironcloud/config/legal';

import { LegalDocumentScreen } from '../../src/features/legal/components/LegalDocumentScreen';

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title={TERMS_TITLE}
      lastUpdated={LEGAL_LAST_UPDATED}
      sections={TERMS_SECTIONS}
    />
  );
}
