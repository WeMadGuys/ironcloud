export type LegalSection = {
  heading: string;
  body: string;
};

export const LEGAL_LAST_UPDATED = '8 August 2026';

export const APP_LEGAL_NAME = 'Iron Cloud';
export const APP_ENTERPRISE_NAME = 'IRON CLOUD';
export const APP_UDYAM_NUMBER = 'UDYAM-TS-09-0264194';
export const APP_SUPPORT_EMAIL = 'support@ironcloud.co.in';
export const APP_SUPPORT_PHONE = '+91 99125 45050';
export const APP_SUPPORT_PHONE_TEL = '+919912545050';
export const APP_BUSINESS_ADDRESS =
  '607, Block D, Avantika Espino, Ameenpur Road, Ameenpur, Hyderabad, Ranga Reddy Dist., Telangana 502032';

export const APP_WEBSITE_URL = 'https://ironcloud.co.in';
export const APP_PRIVACY_POLICY_URL = `${APP_WEBSITE_URL}/privacy-policy`;
export const APP_TERMS_URL = `${APP_WEBSITE_URL}/terms-and-conditions`;

/** Shared contact line for policy footers. */
export const APP_CONTACT_DETAILS = `${APP_SUPPORT_EMAIL} | ${APP_SUPPORT_PHONE} | ${APP_BUSINESS_ADDRESS}`;

export const PRIVACY_POLICY_TITLE = 'Privacy Policy';
export const TERMS_TITLE = 'Terms of Service';
export const REFUND_POLICY_TITLE = 'Cancellation & Refund Policy';
export const SHIPPING_POLICY_TITLE = 'Shipping & Delivery Policy';

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Introduction',
    body: `${APP_LEGAL_NAME} (“we”, “us”, or “our”) provides doorstep laundry and ironing services through our customer and rider mobile applications and related websites (the “Services”). This Privacy Policy explains how we collect, use, store, and share personal information when you use the Services.`,
  },
  {
    heading: '2. Information we collect',
    body: `We may collect: account details (name, phone number, email); delivery address and community/tower/flat information; order, payment, and wallet transaction history; device and app usage data needed to operate the app; and location or job-related data for riders while fulfilling assigned pickups and deliveries. Phone numbers used for login may be processed through our OTP provider to send and verify one-time passwords.`,
  },
  {
    heading: '3. How we use information',
    body: `We use personal information to create and manage your account, verify your phone number via OTP, process bookings and payments, assign and complete pickup/delivery jobs, communicate service updates, provide customer support, improve safety and reliability, and comply with legal obligations.`,
  },
  {
    heading: '4. Sharing of information',
    body: `We share information with service partners and riders only as needed to fulfil your order; with Razorpay to process wallet top-ups and digital payments; with MSG91 to send and verify OTP login codes; and with service providers who help us host and operate the Services. We do not sell your personal information.`,
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
    body: `For privacy questions or requests, contact us at ${APP_CONTACT_DETAILS}. Enterprise: ${APP_ENTERPRISE_NAME} (${APP_UDYAM_NUMBER}).`,
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
    body: `Prices, estimates, and final charges are shown in the app. Wallet and other payment methods may be used where offered. Cancellations are allowed only before pickup is completed, subject to in-app rules and our Cancellation & Refund Policy.`,
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
    body: `Questions about these Terms: ${APP_CONTACT_DETAILS}. Enterprise: ${APP_ENTERPRISE_NAME} (${APP_UDYAM_NUMBER}).`,
  },
];

export const REFUND_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Overview',
    body: `This Cancellation & Refund Policy explains when ${APP_LEGAL_NAME} may issue refunds, credits, or adjustments for orders placed through our apps and related Services.`,
  },
  {
    heading: '2. Cancellations before pickup',
    body: `You may cancel an order before pickup is completed, subject to the rules shown in the app. Orders cancelled in time are typically not charged. If a payment or wallet debit has already been processed, we will refund or reverse it within 5–7 business days after the cancellation is confirmed.`,
  },
  {
    heading: '3. After pickup',
    body: `Once a rider has completed pickup, the order generally cannot be cancelled and charges for completed processing apply. If service cannot be completed for reasons within our control (for example, lost garments in our custody), we will offer a refund, credit, or other remedy as appropriate within 5–7 business days of approving the claim.`,
  },
  {
    heading: '4. Service quality issues',
    body: `If garments are damaged, lost, or returned in unsatisfactory condition due to our handling, contact support promptly with your order details and photos where relevant. We will investigate and may provide a refund, wallet credit, or re-service, up to the amount paid for the affected order items. Approved refunds are processed within 5–7 business days.`,
  },
  {
    heading: '5. Wallet and payment adjustments',
    body: `Wallet top-ups are generally non-refundable once credited, except where required by law or where a top-up failed but funds were still debited. Duplicate charges and failed payment recoveries are corrected after we verify the transaction, typically within 5–7 business days.`,
  },
  {
    heading: '6. How to request a refund',
    body: `Request refunds or adjustments from the in-app support flow, by emailing ${APP_SUPPORT_EMAIL}, or by calling ${APP_SUPPORT_PHONE}, with your registered phone number, order ID, and a short description of the issue. We aim to respond within 2–3 business days.`,
  },
  {
    heading: '7. Changes',
    body: `We may update this Refund Policy from time to time. The “Last updated” date at the top of this page reflects the latest revision.`,
  },
  {
    heading: '8. Contact',
    body: `Questions about refunds: ${APP_CONTACT_DETAILS}. Enterprise: ${APP_ENTERPRISE_NAME} (${APP_UDYAM_NUMBER}).`,
  },
];

export const SHIPPING_POLICY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Overview',
    body: `${APP_LEGAL_NAME} provides doorstep pickup and delivery of garments for ironing. This Shipping & Delivery Policy explains how pickup and return delivery work. We do not ship retail products; “shipping” here means service logistics for your clothes.`,
  },
  {
    heading: '2. Service area',
    body: `Pickup and delivery are available only in apartment communities and areas where ${APP_LEGAL_NAME} currently operates. Coverage depends on community partnerships and rider capacity. If your society is not yet covered, you may join the waiting list via our website or app.`,
  },
  {
    heading: '3. Pickup',
    body: `Schedule a pickup slot in the app. A rider will collect garments from the address you provide (typically tower/flat within your community). Please ensure access is available at the scheduled time and garments are ready for collection.`,
  },
  {
    heading: '4. Processing and delivery turnaround',
    body: `Freshly ironed garments are typically returned to your doorstep within 24 hours of successful pickup, subject to order volume, garment type, and community scheduling. Estimated timelines shown in the app apply to each order.`,
  },
  {
    heading: '5. Delays and exceptions',
    body: `Delivery may be delayed due to incorrect or incomplete address details, restricted community access, weather or force majeure events, peak demand, or issues with garments that require special handling. We will notify you through the app or support channels when a material delay is expected.`,
  },
  {
    heading: '6. Failed pickup or delivery attempts',
    body: `If pickup or delivery cannot be completed because the customer is unreachable or access is denied, we may reschedule subject to rider availability. Repeated failed attempts may result in order cancellation under our Cancellation & Refund Policy.`,
  },
  {
    heading: '7. Charges',
    body: `Service charges for ironing, pickup, and delivery are shown in the app before you confirm an order. There are no separate courier shipping fees beyond what is disclosed at checkout.`,
  },
  {
    heading: '8. Contact',
    body: `Questions about pickup or delivery: ${APP_CONTACT_DETAILS}. Enterprise: ${APP_ENTERPRISE_NAME} (${APP_UDYAM_NUMBER}).`,
  },
];
