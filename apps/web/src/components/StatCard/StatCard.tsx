import Icon from '@mdi/react';
import type { ReactNode } from 'react';

import styles from './StatCard.module.css';

type TrendDirection = 'positive' | 'negative' | 'neutral';

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  iconVariant?: 'accent' | 'info' | 'warning' | 'purple' | 'success';
  trend?: { value: string; direction: TrendDirection };
  actionLabel?: string;
  actionHref?: string;
};

const iconVariantClass: Record<NonNullable<StatCardProps['iconVariant']>, string> = {
  accent: styles.iconWrapAccent,
  info: styles.iconWrapInfo,
  warning: styles.iconWrapWarning,
  purple: styles.iconWrapPurple,
  success: styles.iconWrapSuccess,
};

const trendClass: Record<TrendDirection, string> = {
  positive: styles.trendPositive,
  negative: styles.trendNegative,
  neutral: styles.trendNeutral,
};

export const StatCard = ({
  label,
  value,
  icon,
  iconVariant = 'accent',
  trend,
  actionLabel,
  actionHref,
}: StatCardProps) => (
  <div className={styles.statCard}>
    <div className={styles.top}>
      <span className={styles.label}>{label}</span>
      {icon && (
        <div className={`${styles.iconWrap} ${iconVariantClass[iconVariant]}`}>
          {icon}
        </div>
      )}
    </div>
    <div className={styles.value}>{value}</div>
    <div className={styles.footer}>
      {trend ? (
        <span className={`${styles.trend} ${trendClass[trend.direction]}`}>
          {trend.direction === 'positive' ? '↑' : trend.direction === 'negative' ? '↓' : '–'}{' '}
          {trend.value}
        </span>
      ) : <span />}
      {actionLabel && actionHref && (
        <a href={actionHref} className={styles.link}>{actionLabel}</a>
      )}
    </div>
  </div>
);

export const StatCardIcon = ({ path, color }: { path: string; color?: string }) => (
  <Icon path={path} size={0.8} color={color ?? 'var(--ic-brand-accent)'} />
);
