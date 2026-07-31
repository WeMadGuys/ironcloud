'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  EmptyState,
  Loader,
  Pagination,
  SearchInput,
  Table,
} from '@/components';
import {
  fetchCommunityOptions,
  type CommunityOption,
} from '@/features/communities/services/communities.service';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatRelativeTime } from '@/utils/format';

import {
  fetchCustomers,
  type CustomerListRow,
} from '../services/customer.service';

import pageStyles from '@/styles/pages.module.css';
import styles from './CustomersGrid.module.css';

export type CustomerGridMode = 'list' | 'picker';

export type CustomerColumnKey =
  | 'name'
  | 'phone'
  | 'email'
  | 'community'
  | 'city'
  | 'joined'
  | 'actions';

const DEFAULT_VISIBLE: Record<CustomerGridMode, CustomerColumnKey[]> = {
  list: ['name', 'phone', 'email', 'joined', 'actions'],
  picker: ['name', 'phone', 'email', 'community', 'city', 'joined'],
};

const COLUMN_LABELS: Record<CustomerColumnKey, string> = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  community: 'Community',
  city: 'City',
  joined: 'Joined',
  actions: 'Actions',
};

const STORAGE_PREFIX = 'ironcloud_customers_columns_';

function loadVisibleColumns(
  mode: CustomerGridMode,
  allowActions: boolean,
): CustomerColumnKey[] {
  const fallback = DEFAULT_VISIBLE[mode].filter(
    (k) => allowActions || k !== 'actions',
  );
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${mode}`);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return fallback;
    const allowed = new Set(
      Object.keys(COLUMN_LABELS).filter(
        (k) => allowActions || k !== 'actions',
      ) as CustomerColumnKey[],
    );
    const next = parsed.filter((k): k is CustomerColumnKey =>
      allowed.has(k as CustomerColumnKey),
    );
    return next.length > 0 ? next : fallback;
  } catch {
    return fallback;
  }
}

function saveVisibleColumns(mode: CustomerGridMode, keys: CustomerColumnKey[]) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${mode}`, JSON.stringify(keys));
  } catch {
    // ignore
  }
}

type CustomersGridProps = {
  mode: CustomerGridMode;
  pageSize?: number;
  /** list mode: edit/delete/name link handlers */
  onEdit?: (row: CustomerListRow) => void;
  onDelete?: (row: CustomerListRow) => void;
  /** Extra toolbar actions (e.g. Add Customer) */
  toolbarEnd?: ReactNode;
  /** picker mode */
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (next: Set<string>) => void;
};

export function CustomersGrid({
  mode,
  pageSize = 25,
  onEdit,
  onDelete,
  toolbarEnd,
  selectedIds,
  onSelectedIdsChange,
}: CustomersGridProps) {
  const allowActions = mode === 'list';
  const selectionMode = mode === 'picker';

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [city, setCity] = useState('');
  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<CustomerColumnKey[]>(() =>
    loadVisibleColumns(mode, allowActions),
  );

  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    void fetchCommunityOptions().then(setCommunities);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, communityId, city]);

  useEffect(() => {
    saveVisibleColumns(mode, visibleColumns);
  }, [mode, visibleColumns]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const c of communities) {
      const value = c.city?.trim();
      if (value) set.add(value);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [communities]);

  const communityOptions = useMemo(() => {
    if (!city) return communities;
    return communities.filter((c) => c.city === city);
  }, [communities, city]);

  const { data: result, isLoading, isFetching } = useQuery({
    queryKey: [
      'admin-customers',
      mode,
      page,
      pageSize,
      debouncedSearch,
      communityId,
      city,
    ],
    queryFn: () =>
      fetchCustomers({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        communityId: communityId || undefined,
        city: city || undefined,
      }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const data = result?.data ?? [];
  const total = result?.total ?? 0;
  const refreshing = isFetching && !isLoading;

  const pageIds = useMemo(() => data.map((c) => c.id), [data]);
  const selected = selectedIds ?? new Set<string>();
  const allPageSelected =
    selectionMode && pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected =
    selectionMode && pageIds.some((id) => selected.has(id));

  const toggleAllPage = () => {
    if (!onSelectedIdsChange) return;
    const next = new Set(selected);
    if (allPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    onSelectedIdsChange(next);
  };

  const toggleOne = (id: string) => {
    if (!onSelectedIdsChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedIdsChange(next);
  };

  const toggleColumn = (key: CustomerColumnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      const order = Object.keys(COLUMN_LABELS) as CustomerColumnKey[];
      return order.filter((k) => prev.includes(k) || k === key);
    });
  };

  const columns = useMemo(() => {
    type Col = {
      key: string;
      header: ReactNode;
      render: (row: CustomerListRow) => ReactNode;
    };

    const cols: Col[] = [];

    if (selectionMode) {
      cols.push({
        key: 'select',
        header: (
          <input
            type="checkbox"
            checked={allPageSelected}
            ref={(el) => {
              if (el) el.indeterminate = somePageSelected && !allPageSelected;
            }}
            onChange={toggleAllPage}
            aria-label="Select all customers on this page"
          />
        ),
        render: (c) => (
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggleOne(c.id)}
            aria-label={`Select ${c.full_name ?? c.phone ?? c.id}`}
          />
        ),
      });
    }

    for (const key of visibleColumns) {
      if (key === 'name') {
        cols.push({
          key: 'name',
          header: 'Name',
          render: (c) =>
            mode === 'list' ? (
              <a href={`/admin/customers/${c.id}`}>{c.full_name ?? '—'}</a>
            ) : (
              (c.full_name ?? '—')
            ),
        });
      } else if (key === 'phone') {
        cols.push({
          key: 'phone',
          header: 'Phone',
          render: (c) => c.phone ?? '—',
        });
      } else if (key === 'email') {
        cols.push({
          key: 'email',
          header: 'Email',
          render: (c) => c.email ?? '—',
        });
      } else if (key === 'community') {
        cols.push({
          key: 'community',
          header: 'Community',
          render: (c) => c.community_name ?? '—',
        });
      } else if (key === 'city') {
        cols.push({
          key: 'city',
          header: 'City',
          render: (c) => c.city ?? '—',
        });
      } else if (key === 'joined') {
        cols.push({
          key: 'joined',
          header: 'Joined',
          render: (c) => formatRelativeTime(c.created_at),
        });
      } else if (key === 'actions' && allowActions) {
        cols.push({
          key: 'actions',
          header: 'Actions',
          render: (c) => (
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => onEdit?.(c)}
              >
                Edit
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => onDelete?.(c)}
              >
                Delete
              </button>
            </div>
          ),
        });
      }
    }

    return cols;
  }, [
    allowActions,
    allPageSelected,
    mode,
    onDelete,
    onEdit,
    selected,
    selectionMode,
    somePageSelected,
    visibleColumns,
  ]);

  const columnChoices = (
    Object.keys(COLUMN_LABELS) as CustomerColumnKey[]
  ).filter((k) => allowActions || k !== 'actions');

  if (isLoading && !result) return <Loader />;

  return (
    <div style={{ opacity: refreshing ? 0.85 : 1 }}>
      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={pageStyles.select}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setCommunityId('');
          }}
          aria-label="Filter by city"
        >
          <option value="">All cities</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className={pageStyles.select}
          value={communityId}
          onChange={(e) => setCommunityId(e.target.value)}
          aria-label="Filter by community"
        >
          <option value="">All communities</option>
          {communityOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className={styles.columnsWrap}>
          <button
            type="button"
            className={styles.columnsBtn}
            onClick={() => setColumnsOpen((o) => !o)}
            aria-expanded={columnsOpen}
          >
            Columns
          </button>
          {columnsOpen ? (
            <div className={styles.columnsMenu} role="menu">
              {columnChoices.map((key) => (
                <label key={key} className={styles.columnsItem}>
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(key)}
                    onChange={() => toggleColumn(key)}
                  />
                  {COLUMN_LABELS[key]}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        {toolbarEnd ? <div className={pageStyles.filtersAction}>{toolbarEnd}</div> : null}
      </div>

      {selectionMode && selected.size > 0 ? (
        <div className={styles.bulkBar}>
          <span>{selected.size} selected</span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => onSelectedIdsChange?.(new Set())}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      <div
        className={refreshing ? pageStyles.listRefreshing : undefined}
        aria-busy={refreshing}
      >
        {data.length === 0 ? (
          <EmptyState title="No customers found" />
        ) : (
          <>
            <Table
              columns={columns}
              data={data}
              keyExtractor={(c) => c.id}
            />
            <Pagination
              page={page}
              totalPages={Math.max(1, Math.ceil(total / pageSize))}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

export type { CustomerListRow };
