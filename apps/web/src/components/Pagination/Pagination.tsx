'use client';

import styles from './Pagination.module.css';

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export const Pagination = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationProps) => {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <button
        type="button"
        className={styles.button}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        Previous
      </button>
      <span className={styles.info}>
        {start}–{end} of {total}
      </span>
      <button
        type="button"
        className={styles.button}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
};
