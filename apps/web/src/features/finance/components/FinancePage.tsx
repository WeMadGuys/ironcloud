'use client';

import { useEffect, useState } from 'react';

import { Button, Card, Loader, Table } from '@/components';
import { useDateFilter } from '@/contexts/DateFilterContext';
import { formatCurrency } from '@/utils/format';

import { exportOrdersCSV, fetchFinanceOverview } from '../services/finance.service';

import pageStyles from '@/styles/pages.module.css';

export const FinancePage = () => {
  const { selectedDate } = useDateFilter();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchFinanceOverview>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchFinanceOverview(selectedDate).then((d) => { setData(d); setLoading(false); });
  }, [selectedDate]);

  const handleExport = async () => {
    const csv = await exportOrdersCSV(selectedDate);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${selectedDate.toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !data) return <Loader fullPage />;

  return (
    <div>
      <div className={pageStyles.statsGrid}>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(data.revenue)}</div><div className={pageStyles.statLabel}>Revenue</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(data.gstTotal)}</div><div className={pageStyles.statLabel}>GST Collected</div></div>
        <div className={pageStyles.statBox}><div className={pageStyles.statValue}>{formatCurrency(data.refundTotal)}</div><div className={pageStyles.statLabel}>Refunds</div></div>
      </div>
      <div className={pageStyles.filters}>
        <Button variant="secondary" onClick={handleExport}>Export CSV</Button>
      </div>
      <Card title="Settlements">
        <Table
          columns={[
            { key: 'period', header: 'Period', render: (s) => `${new Date(s.period_start).toLocaleDateString()} - ${new Date(s.period_end).toLocaleDateString()}` },
            { key: 'amount', header: 'Amount', render: (s) => formatCurrency(Number(s.amount)) },
            { key: 'status', header: 'Status', render: (s) => s.status },
          ]}
          data={data.settlements}
          keyExtractor={(s) => s.id}
        />
      </Card>
      <Card title="Invoices">
        <Table
          columns={[
            { key: 'number', header: 'Invoice #', render: (i) => i.invoice_number },
            { key: 'total', header: 'Total', render: (i) => formatCurrency(Number(i.total)) },
            { key: 'gst', header: 'GST', render: (i) => formatCurrency(Number(i.gst_amount)) },
            { key: 'date', header: 'Issued', render: (i) => new Date(i.issued_at).toLocaleDateString() },
          ]}
          data={data.invoices}
          keyExtractor={(i) => i.id}
        />
      </Card>
    </div>
  );
};
