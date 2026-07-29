'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Card, EmptyState, Loader, Pagination, Table } from '@/components';
import { formatCurrency } from '@/utils/format';

import { fetchTotalWalletBalance, fetchWallets } from '../services/wallet.service';

import pageStyles from '@/styles/pages.module.css';

export const WalletPage = () => {
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-wallets', page, pageSize],
    queryFn: async () => {
      const [res, bal] = await Promise.all([
        fetchWallets(page, pageSize),
        fetchTotalWalletBalance(),
      ]);
      return { ...res, totalBalance: bal };
    },
    staleTime: 45_000,
    placeholderData: keepPreviousData,
  });

  if (isLoading && !data) return <Loader />;

  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalBalance = data?.totalBalance ?? 0;

  return (
    <div style={{ opacity: isFetching && !isLoading ? 0.85 : 1 }}>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{formatCurrency(totalBalance)}</div>
          <div className={pageStyles.statLabel}>Total Platform Balance</div>
        </div>
        <div className={pageStyles.statBox}>
          <div className={pageStyles.statValue}>{total}</div>
          <div className={pageStyles.statLabel}>Active Wallets</div>
        </div>
      </div>
      <Card title="Customer Wallets">
        {rows.length === 0 ? (
          <EmptyState title="No wallets found" />
        ) : (
          <>
            <Table
              columns={[
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (w) =>
                    (w.profiles as { full_name: string } | null)?.full_name ?? '—',
                },
                {
                  key: 'phone',
                  header: 'Phone',
                  render: (w) =>
                    (w.profiles as { phone: string } | null)?.phone ?? '—',
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  render: (w) => formatCurrency(Number(w.balance)),
                },
              ]}
              data={rows}
              keyExtractor={(w) => w.id}
            />
            <Pagination
              page={page}
              totalPages={Math.ceil(total / pageSize)}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
};
