export type LegalSection = {
  heading: string;
  body: string;
};

export const LEGAL_LAST_UPDATED = '2 August 2026';

export const APP_LEGAL_NAME = 'Iron Cloud';
export const APP_SUPPORT_EMAIL = 'support@ironcloud.app';

export const PRIVACY_POLICY_TITLE = 'Privacy Policy';
export const TERMS_TITLE = 'Terms of Service';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Introduction',
    body: `${APP_LEGAL_NAME} (“we”, “us”, or “our”) provides doorstep laundry and ironing services through our customer and rider mobile applications and related websites (the “Services”). This Privacy Policy explains how we collect, use, store, and share personal information when you use the Services.`,
  },
  {
    heading: '2. Information we collect',
    body: `We may collect: account details (name, phone number, email); delivery address and community/tower/flat information; order, payment, and wallet transaction history; device and app usage data needed to operate the app; and location or job-related data for riders while fulfilling assigned pickups and deliveries.`,
  },
  {
    heading: '3. How we use information',
    body: `We use personal information to create and manage your account, process bookings and payments, assign and complete pickup/delivery jobs, communicate service updates, provide customer support, improve safety and reliability, and comply with legal obligations.`,
  },
  {
    heading: '4. Sharing of information',
    body: `We share information with service partners and riders only as needed to fulfil your order; with payment processors for wallet top-ups and charges; and with service providers who help us host and operate the Services. We do not sell your personal information.`,
  },
  {
    heading: '5. Data retention',
    body: `We retain account and order information for as long as needed to provide the Services, meet accounting and legal requirements, and resolve disputes. If you delete your account, we remove or anonymize personal identifiers while retaining non-identifying order records where required.`,
  },
  {
    heading: '6. Your choices',
    body: `You may update profile details in the app, request support, or delete your account from Profile. Deleting your account removes your ability to sign in and clears or anonymizes personal data as described above.`,
  },
  {
    heading: '7. Security',
    body: `We use reasonable administrative and technical measures to protect personal information. No method of transmission or storage is completely secure.`,
  },
  {
    heading: '8. Children’s privacy',
    body: `The Services are intended for adults. We do not knowingly collect personal information from children.`,
  },
  {
    heading: '9. Contact',
    body: `For privacy questions or requests, contact us at ${APP_SUPPORT_EMAIL}.`,
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. Acceptance of terms',
    body: `By creating an account or using ${APP_LEGAL_NAME}, you agree to these Terms of Service. If you do not agree, do not use the Services.`,
  },
  {
    heading: '2. Accounts',
    body: `You must provide accurate information and keep your login credentials secure. You are responsible for activity under your account. You may delete your account at any time from Profile.`,
  },
  {
    heading: '3. Services',
    body: `${APP_LEGAL_NAME} facilitates pickup, processing, and delivery of garments according to the schedule and pricing shown in the app. Service availability depends on your community coverage and rider capacity.`,
  },
  {
    heading: '4. Orders and payments',
    body: `Prices, estimates, and final charges are shown in the app. Wallet and other payment methods may be used where offered. Cancellations are allowed only before pickup is completed, subject to in-app rules.`,
  },
  {
    heading: '5. Rider obligations',
    body: `Riders must complete assigned jobs safely and professionally, protect customer information, and follow community access rules. Inactive or deleted rider accounts lose access to jobs.`,
  },
  {
    heading: '6. Acceptable use',
    body: `You may not misuse the Services, attempt unauthorized access, harass staff or customers, or submit fraudulent orders or information.`,
  },
  {
    heading: '7. Liability',
    body: `To the fullest extent permitted by law, ${APP_LEGAL_NAME} is not liable for indirect or consequential damages. Our total liability for any claim related to an order is limited to the amount paid for that order.`,
  },
  {
    heading: '8. Changes',
    body: `We may update these Terms from time to time. Continued use of the Services after changes means you accept the updated Terms.`,
  },
  {
    heading: '9. Contact',
    body: `Questions about these Terms: ${APP_SUPPORT_EMAIL}.`,
  },
];
