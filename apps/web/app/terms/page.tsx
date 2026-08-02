import type { Metadata } from 'next';
import Link from 'next/link';

import {
  APP_LEGAL_NAME,
  LEGAL_LAST_UPDATED,
  TERMS_SECTIONS,
  TERMS_TITLE,
} from '@ironcloud/config/legal';

import styles from '../legal.module.css';

export const metadata: Metadata = {
  title: `${TERMS_TITLE} · ${APP_LEGAL_NAME}`,
  description: `Terms of Service for ${APP_LEGAL_NAME} customer and rider apps.`,
};

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.brand}>
          <Link href="/">{APP_LEGAL_NAME}</Link>
        </p>
        <h1 className={styles.title}>{TERMS_TITLE}</h1>
        <p className={styles.meta}>Last updated: {LEGAL_LAST_UPDATED}</p>
        {TERMS_SECTIONS.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.heading}>{section.heading}</h2>
            <p className={styles.body}>{section.body}</p>
          </section>
        ))}
        <p className={styles.footer}>
          <Link href="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </main>
  );
}
