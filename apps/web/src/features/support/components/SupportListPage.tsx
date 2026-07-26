'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Badge,
  EmptyState,
  Loader,
  Pagination,
  SearchInput,
  Table,
} from '@/components';
import { ADMIN_ROUTES } from '@/constants/routes';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatRelativeTime } from '@/utils/format';

import {
  categoryLabel,
  fetchSupportTickets,
  isTicketOpen,
  type SupportTicketListRow,
} from '../services/support.service';

import pageStyles from '@/styles/pages.module.css';
import styles from './SupportListPage.module.css';

type Filter = 'open' | 'resolved';

export const SupportListPage = () => {
  const [filter, setFilter] = useState<Filter>('open');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [data, setData] = useState<SupportTicketListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const pageSize = 25;

  const load = useCallback(() => {
    if (hasLoadedRef.current) setRefreshing(true);
    else setLoading(true);

    fetchSupportTickets({
      page,
      pageSize,
      filter,
      search: debouncedSearch || undefined,
    }).then((res) => {
      setData(res.data);
      setTotal(res.total);
      hasLoadedRef.current = true;
      setLoading(false);
      setRefreshing(false);
    });
  }, [page, pageSize, filter, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter, debouncedSearch]);

  if (loading) return <Loader fullPage />;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className={styles.tabs}>
        {(['open', 'resolved'] as Filter[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${filter === tab ? styles.tabActive : ''}`}
            onClick={() => setFilter(tab)}
          >
            {tab === 'open' ? 'Open' : 'Resolved'}
          </button>
        ))}
      </div>

      <div className={pageStyles.filters}>
        <SearchInput
          placeholder="Search customer, phone, or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={refreshing ? pageStyles.listRefreshing : undefined}>
        {data.length === 0 ? (
          <EmptyState
            title={filter === 'open' ? 'No open requests' : 'No resolved requests'}
            description="Customer support requests will appear here."
          />
        ) : (
          <Table
            columns={[
              {
                key: 'customer',
                header: 'Customer',
                render: (row) => (
                  <div>
                    <div className={styles.primary}>{row.customer_name || 'Unknown'}</div>
                    <div className={styles.meta}>{row.customer_phone || '—'}</div>
                  </div>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (row) => categoryLabel(row.category),
              },
              {
                key: 'preview',
                header: 'Message',
                render: (row) => (
                  <span className={styles.preview}>{row.preview || '—'}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (row) => (
                  <Badge variant={isTicketOpen(row.status) ? 'info' : 'success'}>
                    {isTicketOpen(row.status) ? 'Open' : 'Resolved'}
                  </Badge>
                ),
              },
              {
                key: 'created',
                header: 'Created',
                render: (row) => formatRelativeTime(row.created_at),
              },
              {
                key: 'action',
                header: '',
                render: (row) => (
                  <a href={`${ADMIN_ROUTES.support}/${row.id}`} className={styles.link}>
                    Open
                  </a>
                ),
              },
            ]}
            data={data}
            keyExtractor={(row) => row.id}
          />
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
};
