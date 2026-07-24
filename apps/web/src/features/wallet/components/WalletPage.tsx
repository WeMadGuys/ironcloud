'use client';

import { useEffect, useState } from 'react';

import { Card, EmptyState, Loader, Pagination, Table } from '@/components';
import { formatCurrency } from '@/utils/format';

import { fetchTotalWalletBalance, fetchWallets } from '../services/wallet.service';

import pageStyles from '@/styles/pages.module.css';

export const WalletPage = () => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchWallets>>['data']>([]);
  const [total, setTotal] = useState(0);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchWallets(page, pageSize), fetchTotalWalletBalance()]).then(([res, bal]) => {
      setData(res.data);
      setTotal(res.total);
      setTotalBalance(bal);
      setLoading(false);
    });
  }, [page]);

  if (loading) return <Loader fullPage />;

  return (
    <div>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(totalBalance)}</div><div className={pageStyles.statLabel}>Total Platform Balance</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{total}</div><div className={pageStyles.statLabel}>Active Wallets</div></div>
      </div>
      <Card title="Customer Wallets">
        {data.length === 0 ? <EmptyState title="No wallets found" /> : (
          <>
            <Table
              columns={[
                { key: 'customer', header: 'Customer', render: (w) => (w.profiles as { full_name: string } | null)?.full_name ?? '—' },
                { key: 'phone', header: 'Phone', render: (w) => (w.profiles as { phone: string } | null)?.phone ?? '—' },
                { key: 'balance', header: 'Balance', render: (w) => formatCurrency(Number(w.balance)) },
              ]}
              data={data}
              keyExtractor={(w) => w.id}
            />
            <Pagination page={page} totalPages={Math.ceil(total / pageSize)} total={total} pageSize={pageSize} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
};
