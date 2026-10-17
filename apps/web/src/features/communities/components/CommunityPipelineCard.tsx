'use client';

import { useState } from 'react';

import type { CommunityStage } from '@ironcloud/db';

import { Badge, Button, Card } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { trpc } from '@/lib/trpc';

import { COMMUNITY_STAGES, stageBadge, stageLabel } from '../constants';

import assignStyles from './CommunityDetailPage.module.css';
import styles from './CommunityCrmCards.module.css';
import pageStyles from '@/styles/pages.module.css';

type Props = {
  communityId: string;
  stage: CommunityStage;
  stageUpdatedAt: string | null;
  onStageChanged: () => void;
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const CommunityPipelineCard = ({
  communityId,
  stage,
  stageUpdatedAt,
  onStageChanged,
}: Props) => {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [nextStage, setNextStage] = useState<CommunityStage | ''>('');
  const [note, setNote] = useState('');

  const historyQuery = trpc.communities.listStageHistory.useQuery(
    { communityId },
    { refetchOnWindowFocus: false },
  );

  const setStageMutation = trpc.communities.setStage.useMutation({
    onSuccess: async () => {
      toast('Stage updated', 'success');
      setNextStage('');
      setNote('');
      await utils.communities.listStageHistory.invalidate({ communityId });
      onStageChanged();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const history = historyQuery.data ?? [];

  return (
    <Card
      title="Pipeline"
      subtitle={
        stageUpdatedAt
          ? `In this stage since ${formatDateTime(stageUpdatedAt)}`
          : 'Track this community from lead to active'
      }
    >
      <div className={assignStyles.assignPanel}>
        <div>
          <Badge variant={stageBadge(stage)} size="md">
            {stageLabel(stage)}
          </Badge>
          {stage !== 'active' ? (
            <p className={assignStyles.statusLine}>
              Customers can't see this community until it is Active.
            </p>
          ) : null}
        </div>

        <div className={assignStyles.assignBox}>
          <label className={assignStyles.assignLabel} htmlFor="pipeline-next-stage">
            Move to
          </label>
          <div className={styles.form}>
            <select
              id="pipeline-next-stage"
              className={assignStyles.assignSelect}
              value={nextStage}
              onChange={(e) => setNextStage(e.target.value as CommunityStage | '')}
              disabled={setStageMutation.isPending}
            >
              <option value="">Choose a stage…</option>
              {COMMUNITY_STAGES.filter((option) => option.value !== stage).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              className={assignStyles.assignSelect}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional), e.g. FM agreed in meeting"
              aria-label="Stage change note"
              disabled={setStageMutation.isPending}
            />
            <div className={styles.formActions}>
              <Button
                onClick={() =>
                  nextStage &&
                  setStageMutation.mutate({
                    id: communityId,
                    stage: nextStage,
                    note: note.trim() || undefined,
                  })
                }
                disabled={!nextStage || setStageMutation.isPending}
              >
                {setStageMutation.isPending ? 'Updating…' : 'Update stage'}
              </Button>
            </div>
          </div>
        </div>

        <div>
          <p className={assignStyles.assignLabel}>History</p>
          {historyQuery.isLoading ? (
            <p className={assignStyles.statusLine}>Loading history…</p>
          ) : history.length === 0 ? (
            <p className={assignStyles.statusLine}>No stage changes recorded yet.</p>
          ) : (
            <ul className={pageStyles.timeline}>
              {history.map((row) => (
                <li key={row.id} className={pageStyles.timelineItem}>
                  <div className={styles.itemTitle}>
                    {row.from_stage
                      ? `${stageLabel(row.from_stage)} → ${stageLabel(row.to_stage)}`
                      : `Started as ${stageLabel(row.to_stage)}`}
                  </div>
                  {row.note ? <div className={styles.itemMeta}>{row.note}</div> : null}
                  <div className={pageStyles.timelineTime}>
                    {formatDateTime(row.created_at)}
                    {row.changedByName ? ` · ${row.changedByName}` : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
};
