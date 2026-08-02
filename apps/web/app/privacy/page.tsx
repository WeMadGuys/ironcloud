import type { Metadata } from 'next';
import Link from 'next/link';

import {
  APP_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_TITLE,
} from '@ironcloud/config/legal';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: `${PRIVACY_POLICY_TITLE} · ${APP_LEGAL_NAME}`,
  description: `Privacy Policy for ${APP_LEGAL_NAME} customer and rider apps.`,
};

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.brand}>
          <Link href="/">{APP_LEGAL_NAME}</Link>
        </p>
        <h1 className={styles.title}>{PRIVACY_POLICY_TITLE}</h1>
        <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>
        {PRIVACY_POLICY_SECTIONS.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.heading}>{section.heading}</h2>
            <p className={styles.body}>{section.body}</p>
          </section>
        ))}
        <p className={styles.footer}>
          <Link href="/terms">Terms of Service</Link>
        </p>
      </div>
    </main>
  );
}
