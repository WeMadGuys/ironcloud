import Link from 'next/link';

import styles from './DetailBackLink.module.css';

type DetailBackLinkProps = {
  href: string;
  label: string;
};

export const DetailBackLink = ({ href, label }: DetailBackLinkProps) => (
  <Link href={href} className={styles.backLink}>
    <span className={styles.backArrow} aria-hidden>
      ←
    </span>
    {label}
  </Link>
);
