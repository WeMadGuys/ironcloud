'use client';

import { useEffect, useState } from 'react';

import { Card, Loader, Pagination, Table } from '@/components';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeTime } from '@/utils/format';

import { fetchAuditLogs, fetchPricingRules, fetchRolePermissions, fetchServiceSlots, fetchSystemSettings } from '../services/settings.service';

import pageStyles from '@/styles/pages.module.css';

export const SettingsPage = () => {
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchSystemSettings>>>([]);
  const [permissions, setPermissions] = useState<Awaited<ReturnType<typeof fetchRolePermissions>>>([]);
  const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof fetchAuditLogs>>['data']>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [pricing, setPricing] = useState<Awaited<ReturnType<typeof fetchPricingRules>>>([]);
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof fetchServiceSlots>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('general');
  const [auditPage, setAuditPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    Promise.all([
      fetchSystemSettings(),
      fetchRolePermissions(),
      fetchAuditLogs(auditPage, pageSize),
      fetchPricingRules(),
      fetchServiceSlots(),
    ]).then(([s, p, a, pr, sl]) => {
      setSettings(s);
      setPermissions(p);
      setAuditLogs(a.data);
      setAuditTotal(a.total);
      setPricing(pr);
      setSlots(sl);
      setLoading(false);
    });
  }, [auditPage]);

  if (loading) return <Loader fullPage />;

  const tabs = ['general', 'pricing', 'slots', 'permissions', 'audit'];

  return (
    <div>
      <div className={pageStyles.tabs}>
        {tabs.map((t) => (
          <button key={t} type="button" className={`${pageStyles.tab} ${tab === t ? pageStyles.tabActive : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <Card title="System Settings">
          <p>Theme: {theme}</p>
          <button type="button" onClick={toggleTheme}>Toggle Theme</button>
          {settings.map((s) => (
            <p key={s.key}><strong>{s.key}:</strong> {JSON.stringify(s.value)}</p>
          ))}
        </Card>
      )}

      {tab === 'pricing' && (
        <Card title="Pricing Rules">
          <Table columns={[
            { key: 'service', header: 'Service', render: (p) => (p.services as { name: string } | null)?.name ?? '—' },
            { key: 'community', header: 'Community', render: (p) => (p.communities as { name: string } | null)?.name ?? 'Default' },
            { key: 'price', header: 'Base Price', render: (p) => p.base_price },
          ]} data={pricing} keyExtractor={(p) => p.id} />
        </Card>
      )}

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

      {tab === 'permissions' && (
        <Card title="Role Permissions">
          <Table columns={[
            { key: 'role', header: 'Role', render: (p) => p.role },
            { key: 'resource', header: 'Resource', render: (p) => p.resource },
            { key: 'action', header: 'Action', render: (p) => p.action },
          ]} data={permissions} keyExtractor={(p) => p.id} />
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
