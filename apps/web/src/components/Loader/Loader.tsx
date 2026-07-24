import styles from './Loader.module.css';

type LoaderProps = { fullPage?: boolean };

export const Loader = ({ fullPage }: LoaderProps) => (
  <div className={`${styles.wrapper} ${fullPage ? styles.fullPage : ''}`} role="status" aria-label="Loading">
    <div className={styles.spinner} />
  </div>
);
