import type { TicketStatus } from '@ironcloud/db';

import { getSupabase } from '@/lib/supabase';

export const OPEN_STATUSES: TicketStatus[] = ['open', 'in_progress', 'escalated'];
export const RESOLVED_STATUSES: TicketStatus[] = ['resolved', 'closed'];

export const CATEGORY_LABELS: Record<string, string> = {
  order_issue: 'Order issue',
  delivery_delay: 'Delivery delay',
  payment_wallet: 'Payment / Wallet',
  quality: 'Quality',
  cancellation: 'Cancellation',
  account: 'Account',
  other: 'Other',
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function isTicketOpen(status: TicketStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export type SupportTicketListRow = {
  id: string;
  customer_id: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  preview: string | null;
};

export type SupportTicketDetail = {
  id: string;
  customer_id: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  customer_name: string | null;
  customer_phone: string | null;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string | null;
  message: string;
  created_at: string;
  sender_name: string | null;
  sender_role: string | null;
};

export type FetchTicketsParams = {
  page: number;
  pageSize: number;
  filter: 'open' | 'resolved';
  search?: string;
};

type TicketRow = {
  id: string;
  customer_id: string;
  category: string;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_note?: string | null;
};

async function loadProfiles(ids: string[]) {
  const map = new Map<string, { full_name: string | null; phone: string | null; role?: string | null }>();
  if (ids.length === 0) return map;
  const supabase = getSupabase();
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, phone, role')
    .in('id', ids);
  for (const p of (data ?? []) as {
    id: string;
    full_name: string | null;
    phone: string | null;
    role: string | null;
  }[]) {
    map.set(p.id, p);
  }
  return map;
}

async function loadPreviews(ticketIds: string[]) {
  const map = new Map<string, string>();
  if (ticketIds.length === 0) return map;
  const supabase = getSupabase();
  const { data } = await supabase
    .from('ticket_messages')
    .select('ticket_id, message, created_at')
    .in('ticket_id', ticketIds)
    .order('created_at', { ascending: true });
  for (const row of (data ?? []) as { ticket_id: string; message: string }[]) {
    if (!map.has(row.ticket_id)) map.set(row.ticket_id, row.message);
  }
  return map;
}

export const fetchSupportTickets = async (
  params: FetchTicketsParams,
): Promise<{ data: SupportTicketListRow[]; total: number }> => {
  const supabase = getSupabase();
  const { page, pageSize, filter, search } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const statuses = filter === 'open' ? OPEN_STATUSES : RESOLVED_STATUSES;
  const q = search?.trim().toLowerCase();

  if (q) {
    const { data } = await supabase
      .from('support_tickets')
      .select('id, customer_id, category, status, created_at, resolved_at')
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(300);

    const tickets = (data ?? []) as TicketRow[];
    const profiles = await loadProfiles([...new Set(tickets.map((t) => t.customer_id))]);

    const matched = tickets.filter((t) => {
      const profile = profiles.get(t.customer_id);
      const name = profile?.full_name?.toLowerCase() ?? '';
      const phone = profile?.phone ?? '';
      return (
        t.category.toLowerCase().includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        categoryLabel(t.category).toLowerCase().includes(q)
      );
    });

    const pageRows = matched.slice(from, to + 1);
    const previews = await loadPreviews(pageRows.map((t) => t.id));

    return {
      total: matched.length,
      data: pageRows.map((t) => {
        const profile = profiles.get(t.customer_id);
        return {
          id: t.id,
          customer_id: t.customer_id,
          category: t.category,
          status: t.status,
          created_at: t.created_at,
          resolved_at: t.resolved_at,
          customer_name: profile?.full_name ?? null,
          customer_phone: profile?.phone ?? null,
          preview: previews.get(t.id) ?? null,
        };
      }),
    };
  }

  const { data, count, error } = await supabase
    .from('support_tickets')
    .select('id, customer_id, category, status, created_at, resolved_at', { count: 'exact' })
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('[Support] fetchSupportTickets:', error.message);
    return { data: [], total: 0 };
  }

  const tickets = (data ?? []) as TicketRow[];
  const profiles = await loadProfiles([...new Set(tickets.map((t) => t.customer_id))]);
  const previews = await loadPreviews(tickets.map((t) => t.id));

  return {
    total: count ?? 0,
    data: tickets.map((t) => {
      const profile = profiles.get(t.customer_id);
      return {
        id: t.id,
        customer_id: t.customer_id,
        category: t.category,
        status: t.status,
        created_at: t.created_at,
        resolved_at: t.resolved_at,
        customer_name: profile?.full_name ?? null,
        customer_phone: profile?.phone ?? null,
        preview: previews.get(t.id) ?? null,
      };
    }),
  };
};

export const fetchSupportTicketById = async (
  ticketId: string,
): Promise<{
  ticket: SupportTicketDetail | null;
  messages: SupportMessage[];
}> => {
  const supabase = getSupabase();

  const { data: ticketRow, error } = await supabase
    .from('support_tickets')
    .select('id, customer_id, category, status, created_at, resolved_at, resolution_note')
    .eq('id', ticketId)
    .single();

  if (error || !ticketRow) {
    return { ticket: null, messages: [] };
  }

  const raw = ticketRow as TicketRow & { resolution_note: string | null };
  const customerProfile = (await loadProfiles([raw.customer_id])).get(raw.customer_id);

  const { data: messageRows } = await supabase
    .from('ticket_messages')
    .select('id, ticket_id, sender_id, message, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  const messagesRaw = (messageRows ?? []) as {
    id: string;
    ticket_id: string;
    sender_id: string | null;
    message: string;
    created_at: string;
  }[];

  const senderIds = [
    ...new Set(messagesRaw.map((m) => m.sender_id).filter(Boolean) as string[]),
  ];
  const senders = await loadProfiles(senderIds);

  return {
    ticket: {
      id: raw.id,
      customer_id: raw.customer_id,
      category: raw.category,
      status: raw.status,
      created_at: raw.created_at,
      resolved_at: raw.resolved_at,
      resolution_note: raw.resolution_note,
      customer_name: customerProfile?.full_name ?? null,
      customer_phone: customerProfile?.phone ?? null,
    },
    messages: messagesRaw.map((m) => {
      const sender = m.sender_id ? senders.get(m.sender_id) : null;
      return {
        ...m,
        sender_name: sender?.full_name ?? null,
        sender_role: sender?.role ?? null,
      };
    }),
  };
};
