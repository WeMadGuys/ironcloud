'use client';

import { useEffect, useState } from 'react';

import { Card, Loader, Pagination, Table } from '@/components';
import { formatRelativeTime } from '@/utils/format';

import {
  fetchAuditLogs,
  fetchServiceSlots,
} from '../services/settings.service';
import { AppUpdatePanel } from './AppUpdatePanel';
import { PricingRulesPanel } from './PricingRulesPanel';

import pageStyles from '@/styles/pages.module.css';

export const SettingsPage = () => {
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof fetchAuditLogs>>['data']>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof fetchServiceSlots>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pricing');
  const [auditPage, setAuditPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    Promise.all([
      fetchAuditLogs(auditPage, pageSize),
      fetchServiceSlots(),
    ]).then(([a, sl]) => {
      setAuditLogs(a.data);
      setAuditTotal(a.total);
      setSlots(sl);
      setLoading(false);
    });
  }, [auditPage]);

  if (loading) return <Loader fullPage />;

  const tabs = [
    { id: 'pricing', label: 'Pricing' },
    { id: 'slots', label: 'Slots' },
    { id: 'app-update', label: 'App update' },
    { id: 'audit', label: 'Audit' },
  ];

  return (
    <div>
      <div className={`${pageStyles.tabs} ${pageStyles.tabsScroll}`}>
        {tabs.map((item) => (
          <button key={item.id} type="button" className={`${pageStyles.tab} ${tab === item.id ? pageStyles.tabActive : ''}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'pricing' && <PricingRulesPanel />}

      {tab === 'app-update' && <AppUpdatePanel />}

      {tab === 'slots' && (
        <Card title="Service Slots">
          <Table columns={[
            { key: 'community', header: 'Community', render: (s) => (s.communities as { name: string } | null)?.name ?? '—' },
            { key: 'type', header: 'Type', render: (s) => s.slot_type },
            { key: 'window', header: 'Window', render: (s) => `${new Date(s.window_start).toLocaleString()} - ${new Date(s.window_end).toLocaleString()}` },
            { key: 'capacity', header: 'Capacity', render: (s) => `${s.booked_count}/${s.capacity}` },
          ]} data={slots} keyExtractor={(s) => s.id} />
        </Card>
      )}

      {tab === 'audit' && (
        <Card title="Audit Logs">
          <Table columns={[
            { key: 'action', header: 'Action', render: (l) => l.action },
            { key: 'entity', header: 'Entity', render: (l) => `${l.entity_type}${l.entity_id ? ` (${l.entity_id.slice(0, 8)}...)` : ''}` },
            { key: 'actor', header: 'Actor', render: (l) => (l.profiles as { full_name: string } | null)?.full_name ?? 'System' },
            { key: 'time', header: 'Time', render: (l) => formatRelativeTime(l.created_at) },
          ]} data={auditLogs} keyExtractor={(l) => l.id} />
          <Pagination page={auditPage} totalPages={Math.ceil(auditTotal / pageSize)} total={auditTotal} pageSize={pageSize} onPageChange={setAuditPage} />
        </Card>
      )}
    </div>
  );
};
