import type { ReactNode } from 'react';

import styles from './Table.module.css';

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onSort?: (key: string) => void;
  sortKey?: string;
};

export const Table = <T,>({
  columns,
  data,
  keyExtractor,
  onSort,
  sortKey,
}: TableProps<T>) => (
  <div className={styles.container}>
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`${styles.th} ${col.sortable ? styles.thSortable : ''}`}
              onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
              aria-sort={sortKey === col.key ? 'ascending' : undefined}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={keyExtractor(row)} className={i % 2 === 1 ? styles.trAlt : styles.tr}>
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
