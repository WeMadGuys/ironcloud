import type { TicketStatus } from '@ironcloud/db';

import { supabase } from '../../../lib/supabase';

const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_AUTH_PROVIDER === 'mock';
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000001';

export const SUPPORT_CATEGORIES = [
  { value: 'order_issue', label: 'Order issue' },
  { value: 'delivery_delay', label: 'Delivery delay' },
  { value: 'payment_wallet', label: 'Payment / Wallet' },
  { value: 'quality', label: 'Quality' },
  { value: 'cancellation', label: 'Cancellation' },
  { value: 'other', label: 'Other' },
] as const;

export type SupportCategoryValue = (typeof SUPPORT_CATEGORIES)[number]['value'];

export type SupportTicket = {
  id: string;
  customer_id: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  message: string;
  created_at: string;
};

export type SupportTicketWithPreview = SupportTicket & {
  preview: string | null;
};

const OPEN_STATUSES: TicketStatus[] = ['open', 'in_progress', 'escalated'];
const RESOLVED_STATUSES: TicketStatus[] = ['resolved', 'closed'];

export function isTicketOpen(status: TicketStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function categoryLabel(category: string): string {
  return SUPPORT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

async function getCurrentUserId(): Promise<string> {
  if (IS_MOCK_AUTH) {
    return MOCK_USER_ID;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;
  if (sessionUserId) return sessionUserId;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user.id;
}

export async function listTickets(
  filter: 'open' | 'resolved',
): Promise<SupportTicketWithPreview[]> {
  const userId = await getCurrentUserId();
  const statuses = filter === 'open' ? OPEN_STATUSES : RESOLVED_STATUSES;

  const { data, error } = await (supabase
    .from('support_tickets') as ReturnType<typeof supabase.from>)
    .select('id, customer_id, category, status, created_at, resolved_at')
    .eq('customer_id', userId)
    .in('status', statuses)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Support] listTickets error:', error.message);
    throw new Error(error.message);
  }

  const tickets = (data ?? []) as SupportTicket[];
  if (tickets.length === 0) return [];

  const ids = tickets.map((t) => t.id);
  const { data: messages } = await (supabase
    .from('ticket_messages') as ReturnType<typeof supabase.from>)
    .select('ticket_id, message, created_at')
    .in('ticket_id', ids)
    .order('created_at', { ascending: true });

  const previewByTicket = new Map<string, string>();
  for (const row of (messages ?? []) as { ticket_id: string; message: string }[]) {
    if (!previewByTicket.has(row.ticket_id)) {
      previewByTicket.set(row.ticket_id, row.message);
    }
  }

  return tickets.map((t) => ({
    ...t,
    preview: previewByTicket.get(t.id) ?? null,
  }));
}

export async function createTicket(params: {
  category: SupportCategoryValue;
  description: string;
}): Promise<SupportTicket> {
  const userId = await getCurrentUserId();
  const description = params.description.trim();
  if (!description) {
    throw new Error('Please describe your issue');
  }

  const { data: ticket, error: ticketError } = await (supabase
    .from('support_tickets') as ReturnType<typeof supabase.from>)
    .insert({
      customer_id: userId,
      category: params.category,
      status: 'open',
    })
    .select('id, customer_id, category, status, created_at, resolved_at')
    .single();

  if (ticketError || !ticket) {
    console.error('[Support] createTicket error:', ticketError?.message);
    throw new Error(ticketError?.message || 'Failed to create support request');
  }

  const created = ticket as SupportTicket;

  const { error: messageError } = await (supabase
    .from('ticket_messages') as ReturnType<typeof supabase.from>)
    .insert({
      ticket_id: created.id,
      sender_id: userId,
      message: description,
    });

  if (messageError) {
    console.error('[Support] first message error:', messageError.message);
    throw new Error(messageError.message);
  }

  return created;
}

export async function getTicketWithMessages(ticketId: string): Promise<{
  ticket: SupportTicket;
  messages: TicketMessage[];
  currentUserId: string;
}> {
  const userId = await getCurrentUserId();

  const { data: ticket, error: ticketError } = await (supabase
    .from('support_tickets') as ReturnType<typeof supabase.from>)
    .select('id, customer_id, category, status, created_at, resolved_at')
    .eq('id', ticketId)
    .eq('customer_id', userId)
    .single();

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message || 'Support request not found');
  }

  const { data: messages, error: messagesError } = await (supabase
    .from('ticket_messages') as ReturnType<typeof supabase.from>)
    .select('id, ticket_id, sender_id, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  return {
    ticket: ticket as SupportTicket,
    messages: (messages ?? []) as TicketMessage[],
    currentUserId: userId,
  };
}

export async function sendMessage(ticketId: string, message: string): Promise<TicketMessage> {
  const userId = await getCurrentUserId();
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }

  const { data: ticket, error: ticketError } = await (supabase
    .from('support_tickets') as ReturnType<typeof supabase.from>)
    .select('id, status, customer_id')
    .eq('id', ticketId)
    .eq('customer_id', userId)
    .single();

  if (ticketError || !ticket) {
    throw new Error(ticketError?.message || 'Support request not found');
  }

  if (!isTicketOpen((ticket as { status: TicketStatus }).status)) {
    throw new Error('This request is resolved. Please open a new one.');
  }

  const { data, error } = await (supabase
    .from('ticket_messages') as ReturnType<typeof supabase.from>)
    .insert({
      ticket_id: ticketId,
      sender_id: userId,
      message: trimmed,
    })
    .select('id, ticket_id, sender_id, message, created_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to send message');
  }

  return data as TicketMessage;
}
