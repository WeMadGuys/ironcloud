import Link from 'next/link';
import Icon from '@mdi/react';
import { mdiInstagram, mdiLinkedin, mdiTwitter } from '@mdi/js';

import {
  BUSINESS_ADDRESS,
  ENTERPRISE_NAME,
  FOOTER_COMPANY_LINKS,
  FOOTER_LEGAL_LINKS,
  SITE_NAME,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  SUPPORT_PHONE_TEL,
  UDYAM_NUMBER,
} from '@/constants/marketing';

import styles from './Footer.module.css';

const SOCIAL_LINKS = [
  { label: 'Instagram', href: '#', icon: mdiInstagram },
  { label: 'LinkedIn', href: '#', icon: mdiLinkedin },
  { label: 'X formerly Twitter', href: '#', icon: mdiTwitter },
] as const;

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandCol}>
          <p className={styles.brand}>{SITE_NAME}</p>
          <p className={styles.tagline}>
            Premium ironing pickup and delivery for modern apartment living.
          </p>
          <p className={styles.meta}>{ENTERPRISE_NAME}</p>
          <p className={styles.meta}>UDYAM: {UDYAM_NUMBER}</p>
          <p className={styles.address}>{BUSINESS_ADDRESS}</p>
          <a className={styles.email} href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          <a className={styles.phone} href={`tel:${SUPPORT_PHONE_TEL}`}>
            {SUPPORT_PHONE}
          </a>
        </div>

        <div className={styles.linkCol}>
          <p className={styles.heading}>Company</p>
          <ul className={styles.list}>
            {FOOTER_COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.linkCol}>
          <p className={styles.heading}>Legal</p>
          <ul className={styles.list}>
            {FOOTER_LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
            <li>
              <Link href="/contact">Contact</Link>
            </li>
          </ul>
        </div>

        <div className={styles.linkCol}>
          <p className={styles.heading}>Social</p>
          <ul className={styles.social}>
            {SOCIAL_LINKS.map((item) => (
              <li key={item.label}>
                <a href={item.href} aria-label={item.label} className={styles.socialLink}>
                  <Icon path={item.icon} size={0.95} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.bottom}>
        <p>
          © {year} {SITE_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
