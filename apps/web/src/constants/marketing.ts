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
  'Iron Cloud provides doorstep laundry ironing pickup and delivery. Contact us or review our policies.';
export const SUPPORT_EMAIL = APP_SUPPORT_EMAIL;
export const SUPPORT_PHONE = APP_SUPPORT_PHONE;
export const SUPPORT_PHONE_TEL = APP_SUPPORT_PHONE_TEL;
export const BUSINESS_ADDRESS = APP_BUSINESS_ADDRESS;
export const ENTERPRISE_NAME = APP_ENTERPRISE_NAME;
export const UDYAM_NUMBER = APP_UDYAM_NUMBER;

export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Contact', href: '/contact' },
  { label: 'Pricing', href: '/pricing' },
] as const;

export const FOOTER_COMPANY_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Contact', href: '/contact' },
  { label: 'Pricing', href: '/pricing' },
] as const;

export const FOOTER_LEGAL_LINKS = [
  { label: 'Privacy', href: '/privacy-policy' },
  { label: 'Terms', href: '/terms-and-conditions' },
  { label: 'Refund', href: '/refund-policy' },
  { label: 'Shipping', href: '/shipping-policy' },
] as const;
