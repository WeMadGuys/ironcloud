import type { ReactNode } from 'react';

import styles from './Card.module.css';

type CardProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
};

export const Card = ({ children, title, subtitle, action, className }: CardProps) => (
  <div className={`${styles.card} ${className ?? ''}`}>
    {(title || action) && (
      <div className={styles.header}>
        <div>
          {title && <h3 className={styles.title}>{title}</h3>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action && (
          action.href ? (
            <a href={action.href} className={styles.action}>{action.label}</a>
          ) : (
            <button type="button" onClick={action.onClick} className={styles.action}>
              {action.label}
            </button>
          )
        )}
      </div>
    )}
    {children}
  </div>
);
