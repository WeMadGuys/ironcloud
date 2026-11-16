'use client';

import { Card, Table } from '@/components';

import type { fetchOtpSendFailures } from '../services/analytics.service';

import styles from './OtpSendFailuresCard.module.css';

type OtpSendFailures = Awaited<ReturnType<typeof fetchOtpSendFailures>>;

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
});

export const OtpSendFailuresCard = ({ stats }: { stats: OtpSendFailures }) => {
  const subtitle =
    stats.total > stats.rows.length
      ? `${stats.total} failed sends, showing the latest ${stats.rows.length}`
      : `${stats.total} failed send${stats.total === 1 ? '' : 's'}`;

  return (
    <Card
      title="Failed OTP sends"
      subtitle={subtitle}
      className={styles.card}
    >
      {stats.rows.length === 0 ? (
        <p className={styles.empty}>No failed OTP sends.</p>
      ) : (
        <Table
          columns={[
            { key: 'phone', header: 'Phone', render: (row) => row.phone },
            { key: 'message', header: 'Error', render: (row) => row.message },
            {
              key: 'time',
              header: 'Time',
              render: (row) => timeFormat.format(new Date(row.created_at)),
            },
          ]}
          data={stats.rows}
          keyExtractor={(row) => row.id}
        />
      )}
    </Card>
  );
};
