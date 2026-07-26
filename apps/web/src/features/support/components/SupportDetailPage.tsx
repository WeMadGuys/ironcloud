'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Badge, Button, Card, DetailBackLink, Loader } from '@/components';
import { useToast } from '@/components/Toast/ToastProvider';
import { ADMIN_ROUTES } from '@/constants/routes';
import { trpc } from '@/lib/trpc';
import { formatRelativeTime } from '@/utils/format';

import {
  categoryLabel,
  fetchSupportTicketById,
  isTicketOpen,
  type SupportMessage,
  type SupportTicketDetail,
} from '../services/support.service';

import pageStyles from '@/styles/pages.module.css';
import styles from './SupportDetailPage.module.css';

export const SupportDetailPage = () => {
  const params = useParams();
  const ticketId = params.id as string;
  const { toast } = useToast();

  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');

  const replyMutation = trpc.support.reply.useMutation();
  const statusMutation = trpc.support.updateStatus.useMutation();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchSupportTicketById(ticketId);
    setTicket(res.ticket);
    setMessages(res.messages);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReply = async () => {
    const message = draft.trim();
    if (!message) return;
    try {
      await replyMutation.mutateAsync({ ticketId, message });
      setDraft('');
      toast('Reply sent', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to send reply', 'error');
    }
  };

  const handleResolve = async () => {
    try {
      await statusMutation.mutateAsync({ ticketId, status: 'resolved' });
      toast('Marked as resolved', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update status', 'error');
    }
  };

  const handleReopen = async () => {
    try {
      await statusMutation.mutateAsync({ ticketId, status: 'open' });
      toast('Request reopened', 'success');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to reopen', 'error');
    }
  };

  if (loading) return <Loader fullPage />;

  if (!ticket) {
    return (
      <div>
        <DetailBackLink href={ADMIN_ROUTES.support} label="Back to Customer Support" />
        <div>Support request not found</div>
      </div>
    );
  }

  const open = isTicketOpen(ticket.status);

  return (
    <div>
      <DetailBackLink href={ADMIN_ROUTES.support} label="Back to Customer Support" />

      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{categoryLabel(ticket.category)}</h2>
          <p className={styles.subtitle}>
            {ticket.customer_name || 'Unknown customer'}
            {ticket.customer_phone ? ` · ${ticket.customer_phone}` : ''}
            {' · '}
            {formatRelativeTime(ticket.created_at)}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Badge variant={open ? 'info' : 'success'}>
            {open ? 'Open' : 'Resolved'}
          </Badge>
          {open ? (
            <Button
              variant="secondary"
              onClick={handleResolve}
              disabled={statusMutation.isPending}
            >
              Mark resolved
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={handleReopen}
              disabled={statusMutation.isPending}
            >
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className={pageStyles.detailGrid}>
        <Card title="Conversation">
          <div className={styles.thread}>
            {messages.length === 0 ? (
              <p className={styles.emptyThread}>No messages yet.</p>
            ) : (
              messages.map((m) => {
                const isStaff =
                  m.sender_role === 'ops_admin' ||
                  m.sender_role === 'super_admin' ||
                  m.sender_role === 'support_agent';
                return (
                  <div
                    key={m.id}
                    className={`${styles.message} ${isStaff ? styles.messageStaff : styles.messageCustomer}`}
                  >
                    <div className={styles.messageMeta}>
                      <strong>
                        {isStaff ? 'Support' : m.sender_name || 'Customer'}
                      </strong>
                      <span>{formatRelativeTime(m.created_at)}</span>
                    </div>
                    <p className={styles.messageBody}>{m.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {open ? (
            <div className={styles.composer}>
              <textarea
                className={styles.textarea}
                rows={3}
                placeholder="Write a reply to the customer..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={2000}
              />
              <div className={styles.composerActions}>
                <Button
                  onClick={handleReply}
                  disabled={!draft.trim() || replyMutation.isPending}
                >
                  {replyMutation.isPending ? 'Sending…' : 'Send reply'}
                </Button>
              </div>
            </div>
          ) : (
            <p className={styles.resolvedNote}>
              This request is resolved. Reopen it to continue the conversation.
            </p>
          )}
        </Card>

        <Card title="Details">
          <dl className={styles.details}>
            <div>
              <dt>Customer</dt>
              <dd>
                <a href={`${ADMIN_ROUTES.customers}/${ticket.customer_id}`}>
                  {ticket.customer_name || ticket.customer_id}
                </a>
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{ticket.customer_phone || '—'}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{categoryLabel(ticket.category)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{ticket.status}</dd>
            </div>
            {ticket.resolved_at ? (
              <div>
                <dt>Resolved</dt>
                <dd>{formatRelativeTime(ticket.resolved_at)}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </div>
    </div>
  );
};
