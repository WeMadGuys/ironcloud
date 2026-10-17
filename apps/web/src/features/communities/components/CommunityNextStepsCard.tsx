'use client';

import { useState } from 'react';

import { Button, Card } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { trpc } from '@/lib/trpc';

import assignStyles from './CommunityDetailPage.module.css';
import styles from './CommunityCrmCards.module.css';

type Props = {
  communityId: string;
};

/** Local calendar date as YYYY-MM-DD, matching how due dates are stored. */
const todayKey = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const formatDueDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

export const CommunityNextStepsCard = ({ communityId }: Props) => {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [body, setBody] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [showDone, setShowDone] = useState(false);

  const stepsQuery = trpc.communities.listNextSteps.useQuery(
    { communityId },
    { refetchOnWindowFocus: false },
  );

  const refresh = () => utils.communities.listNextSteps.invalidate({ communityId });

  const createMutation = trpc.communities.createNextStep.useMutation({
    onSuccess: async () => {
      toast('Next step added', 'success');
      setBody('');
      setDueDate('');
      await refresh();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const updateMutation = trpc.communities.updateNextStep.useMutation({
    onSuccess: async () => {
      setEditingId(null);
      await refresh();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const deleteMutation = trpc.communities.deleteNextStep.useMutation({
    onSuccess: async () => {
      toast('Next step removed', 'success');
      await refresh();
    },
    onError: (err) => toast(err.message, 'error'),
  });

  const steps = stepsQuery.data ?? [];
  const openSteps = steps.filter((step) => !step.is_done);
  const doneSteps = steps.filter((step) => step.is_done);
  const today = todayKey();
  const overdueCount = openSteps.filter((step) => step.due_date && step.due_date < today).length;
  const isMutating =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleAdd = () => {
    const text = body.trim();
    if (!text) return;
    createMutation.mutate({ communityId, body: text, dueDate: dueDate || null });
  };

  const renderStep = (step: (typeof steps)[number]) => {
    const isOverdue = !step.is_done && Boolean(step.due_date && step.due_date < today);
    const isEditing = editingId === step.id;
    const className = [
      styles.item,
      isOverdue ? styles.itemOverdue : '',
      step.is_done ? styles.itemDone : '',
    ].join(' ');

    if (isEditing) {
      return (
        <li key={step.id} className={styles.item}>
          <div className={`${styles.itemBody} ${styles.form}`}>
            <textarea
              className={assignStyles.flatsInput}
              rows={2}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              aria-label="Edit next step"
            />
            <input
              type="date"
              className={assignStyles.assignSelect}
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              aria-label="Due date"
            />
            <div className={styles.formActions}>
              <Button
                size="sm"
                disabled={isMutating || !editBody.trim()}
                onClick={() =>
                  updateMutation.mutate({
                    id: step.id,
                    communityId,
                    body: editBody.trim(),
                    dueDate: editDueDate || null,
                  })
                }
              >
                Save
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isMutating}
                onClick={() => setEditingId(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </li>
      );
    }

    return (
      <li key={step.id} className={className}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={step.is_done}
          disabled={isMutating}
          aria-label={step.is_done ? 'Mark as not done' : 'Mark as done'}
          onChange={(e) =>
            updateMutation.mutate({ id: step.id, communityId, isDone: e.target.checked })
          }
        />
        <div className={styles.itemBody}>
          <p className={styles.itemTitle}>{step.body}</p>
          <div className={styles.itemMeta}>
            {step.due_date ? (
              <span className={isOverdue ? styles.overdueText : undefined}>
                {isOverdue ? 'Overdue · ' : 'Due '}
                {formatDueDate(step.due_date)}
              </span>
            ) : (
              <span>No due date</span>
            )}
          </div>
        </div>
        <div className={styles.itemActions}>
          {!step.is_done ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={isMutating}
              onClick={() => {
                setEditingId(step.id);
                setEditBody(step.body);
                setEditDueDate(step.due_date ?? '');
              }}
            >
              Edit
            </Button>
          ) : null}
          <Button
            variant="danger"
            size="sm"
            disabled={isMutating}
            onClick={() => deleteMutation.mutate({ id: step.id, communityId })}
          >
            Delete
          </Button>
        </div>
      </li>
    );
  };

  return (
    <Card
      title="Next Steps"
      subtitle={
        stepsQuery.isLoading
          ? 'Loading…'
          : `${openSteps.length} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
      }
    >
      <div className={assignStyles.assignPanel}>
        {stepsQuery.isLoading ? (
          <p className={assignStyles.statusLine}>Loading next steps…</p>
        ) : openSteps.length === 0 ? (
          <div className={assignStyles.emptyBox}>
            <p className={assignStyles.emptyTitle}>No open next steps</p>
            <p className={assignStyles.emptyHint}>
              Add what needs to happen next, e.g. &ldquo;Call FM next week&rdquo;.
            </p>
          </div>
        ) : (
          <ul className={assignStyles.assignedList}>{openSteps.map(renderStep)}</ul>
        )}

        {doneSteps.length > 0 ? (
          <>
            <button
              type="button"
              className={styles.sectionToggle}
              onClick={() => setShowDone((value) => !value)}
            >
              {showDone ? 'Hide' : 'Show'} done ({doneSteps.length})
            </button>
            {showDone ? (
              <ul className={assignStyles.assignedList}>{doneSteps.map(renderStep)}</ul>
            ) : null}
          </>
        ) : null}

        <div className={assignStyles.assignBox}>
          <label className={assignStyles.assignLabel} htmlFor="next-step-body">
            Add next step
          </label>
          <div className={styles.form}>
            <textarea
              id="next-step-body"
              className={assignStyles.flatsInput}
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="e.g. Stall setup planned next week"
              disabled={isMutating}
            />
            <div className={styles.formRow}>
              <input
                type="date"
                className={assignStyles.assignSelect}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label="Due date (optional)"
                disabled={isMutating}
              />
              <Button onClick={handleAdd} disabled={isMutating || !body.trim()}>
                {createMutation.isPending ? 'Adding…' : 'Add step'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
