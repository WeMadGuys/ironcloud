import styles from './Skeleton.module.css';

type SkeletonProps = { variant?: 'text' | 'title' | 'card'; className?: string };

export const Skeleton = ({ variant = 'text', className }: SkeletonProps) => (
  <div className={`${styles.skeleton} ${styles[variant]} ${className ?? ''}`} aria-hidden="true" />
);
