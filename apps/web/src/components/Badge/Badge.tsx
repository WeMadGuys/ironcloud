import type { BadgeVariant } from '@ironcloud/ui';
import type { ReactNode } from 'react';

import styles from './Badge.module.css';

type BadgeProps = {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  children: ReactNode;
};

export const Badge = ({ variant = 'default', size = 'sm', children }: BadgeProps) => (
  <span className={`${styles.badge} ${styles[size]} ${styles[variant]}`}>
    {children}
  </span>
);

export const StatusPill = Badge;
