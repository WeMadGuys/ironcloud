import type { ReactNode } from 'react';

import styles from './Table.module.css';

type Column<T> = {
  key: string;
  header: ReactNode;
  /** Optional second header-row control (e.g. column filter). */
  filter?: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onSort?: (key: string) => void;
  sortKey?: string;
  /** Horizontal + vertical scroll with sticky headers. */
  scrollable?: boolean;
};

export const Table = <T,>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortKey,
  scrollable = false,
}: TableProps<T>) => {
  const hasFilters = columns.some((col) => col.filter != null);

  return (
    <div
      className={`${styles.container} ${scrollable ? styles.scrollable : ''}`}
    >
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`${styles.th} ${col.sortable ? styles.thSortable : ''}`}
                onClick={
                  col.sortable && onSort ? () => onSort(col.key) : undefined
                }
                aria-sort={sortKey === col.key ? 'ascending' : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
          {hasFilters ? (
            <tr>
              {columns.map((col) => (
                <th key={`filter-${col.key}`} className={styles.thFilter}>
                  {col.filter ?? null}
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={keyExtractor(row)}
              className={i % 2 === 1 ? styles.trAlt : styles.tr}
            >
              {columns.map((col) => (
                <td key={col.key} className={styles.td}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
