import type { ReactNode } from 'react';

import styles from './FilterBar.module.css';

export const FilterBar = ({ children }: { children: ReactNode }) => (
  <div className={styles.filterBar} role="toolbar" aria-label="Filters">
    {children}
  </div>
);
