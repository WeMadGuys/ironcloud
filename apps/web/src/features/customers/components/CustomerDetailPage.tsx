'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge, Card, Loader } from '@/components';
import { formatCurrency, formatOrderStatus, getOrderStatusBadge } from '@/utils/format';
import type { OrderStatus } from '@ironcloud/db';

import { fetchCustomerById, fetchCustomerStats } from '../services/customer.service';

import pageStyles from '@/styles/pages.module.css';

export const CustomerDetailPage = () => {
  const params = useParams();
  const customerId = params.id as string;
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchCustomerById>> | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof fetchCustomerStats>> | null>(null);
  const [tab, setTab] = useState('orders');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchCustomerById(customerId), fetchCustomerStats(customerId)]).then(([d, s]) => {
      setData(d);
      setStats(s);
      setLoading(false);
    });
  }, [customerId]);

  if (loading) return <Loader fullPage />;
  if (!data?.profile) return <div>Customer not found</div>;

  const tabs = ['orders', 'wallet', 'addresses', 'subscriptions', 'support'];

  return (
    <div>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(stats?.ltv ?? 0)}</div><div className={pageStyles.statLabel}>Lifetime Value</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{stats?.orderCount ?? 0}</div><div className={pageStyles.statLabel}>Total Orders</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(stats?.aov ?? 0)}</div><div className={pageStyles.statLabel}>Avg Order Value</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(Number(data.wallet?.balance ?? 0))}</div><div className={pageStyles.statLabel}>Wallet Balance</div></div>
      </div>

      <Card title={data.profile.full_name ?? 'Customer'}>
        <p>Phone: {data.profile.phone}</p>
        <p>Email: {data.profile.email ?? '—'}</p>
      </Card>

      <div className={pageStyles.tabs}>
        {tabs.map((t) => (
          <button key={t} type="button" className={`${pageStyles.tab} ${tab === t ? pageStyles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'orders' && (
        <ul>
          {data.orders.map((o) => (
            <li key={o.id}><a href={`/admin/orders/${o.id}`}>{o.order_number}</a> — <Badge variant={getOrderStatusBadge(o.status as OrderStatus)}>{formatOrderStatus(o.status)}</Badge> — {formatCurrency(Number(o.total_amount))}</li>
          ))}
        </ul>
      )}
      {tab === 'wallet' && data.wallet && (
        <div>
          <p>Balance: {formatCurrency(Number(data.wallet.balance))}</p>
          {(data.wallet.wallet_transactions as { type: string; amount: number; created_at: string }[] ?? []).slice(0, 10).map((t, i) => (
            <p key={i}>{t.type}: {formatCurrency(t.amount)}</p>
          ))}
        </div>
      )}
      {tab === 'addresses' && data.addresses.map((a) => {
        const community = a.communities as { name: string } | null;
        return <p key={a.id}>{community?.name} — {a.tower}-{a.flat_number}</p>;
      })}
      {tab === 'subscriptions' && (data.subscriptions.length ? data.subscriptions.map((s) => <p key={s.id}>{s.plan_name} — {s.status}</p>) : <p>No subscriptions</p>)}
      {tab === 'support' && (data.tickets.length ? data.tickets.map((t) => <p key={t.id}>{t.category} — {t.status}</p>) : <p>No tickets</p>)}
    </div>
  );
};
