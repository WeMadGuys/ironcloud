import Link from 'next/link';
import type { LegalSection } from '@ironcloud/config/legal';

import styles from './LegalDocument.module.css';

type LegalDocumentProps = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
  relatedLinks?: Array<{ href: string; label: string }>;
};

export function LegalDocument({
  title,
  lastUpdated,
  sections,
  relatedLinks = [],
}: LegalDocumentProps) {
  return (
    <article className={styles.doc}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.meta}>Last updated: {lastUpdated}</p>
      {sections.map((section) => (
        <section key={section.heading} className={styles.section}>
          <h2 className={styles.heading}>{section.heading}</h2>
          <p className={styles.body}>{section.body}</p>
        </section>
      ))}
      {relatedLinks.length > 0 ? (
        <p className={styles.related}>
          {relatedLinks.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? ' · ' : null}
              <Link href={link.href}>{link.label}</Link>
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );
}
