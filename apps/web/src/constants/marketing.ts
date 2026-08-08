import {
  mdiCalendarCheck,
  mdiTruckDelivery,
  mdiIron,
  mdiClockFast,
  mdiHomeMapMarker,
  mdiCreditCardOutline,
} from '@mdi/js';

import {
  APP_BUSINESS_ADDRESS,
  APP_ENTERPRISE_NAME,
  APP_SUPPORT_EMAIL,
  APP_SUPPORT_PHONE,
  APP_SUPPORT_PHONE_TEL,
  APP_UDYAM_NUMBER,
} from '@ironcloud/config/legal';

export const SITE_NAME = 'Iron Cloud';
export const SITE_TAGLINE = 'Premium laundry ironing pickup & delivery';
export const SITE_DESCRIPTION =
  'Schedule a pickup in the Iron Cloud app. Freshly ironed clothes delivered back to your doorstep.';
export const SUPPORT_EMAIL = APP_SUPPORT_EMAIL;
export const SUPPORT_PHONE = APP_SUPPORT_PHONE;
export const SUPPORT_PHONE_TEL = APP_SUPPORT_PHONE_TEL;
export const BUSINESS_ADDRESS = APP_BUSINESS_ADDRESS;
export const ENTERPRISE_NAME = APP_ENTERPRISE_NAME;
export const UDYAM_NUMBER = APP_UDYAM_NUMBER;

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
] as const;

export const FOOTER_COMPANY_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Contact', href: '/contact' },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms-and-conditions' },
  { label: 'Refund', href: '/refund-policy' },
  { label: 'Shipping', href: '/shipping-policy' },
] as const;

export const HOW_IT_WORKS = [
  {
    title: 'Schedule pickup',
    description: 'Book a convenient slot in the Iron Cloud app from your apartment.',
    icon: mdiCalendarCheck,
  },
  {
    title: 'We collect',
    description: 'A rider picks up your garments from your doorstep at the scheduled time.',
    icon: mdiTruckDelivery,
  },
  {
    title: 'Fresh delivery',
    description: 'Clothes are professionally steam-ironed and returned within about 24 hours.',
    icon: mdiIron,
  },
] as const;

export const BENEFITS = [
  {
    title: '24-hour turnaround',
    description: 'Typical return of freshly pressed clothes within a day of pickup.',
    icon: mdiClockFast,
  },
  {
    title: 'Doorstep service',
    description: 'Pickup and delivery at your flat — no laundry runs required.',
    icon: mdiHomeMapMarker,
  },
  {
    title: 'Digital payments',
    description: 'Pay securely in the app, including wallet top-ups via Razorpay.',
    icon: mdiCreditCardOutline,
  },
] as const;
