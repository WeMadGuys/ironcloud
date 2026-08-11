import type { SupabaseClient } from '@supabase/supabase-js';

import {
  computeNextScheduledAt,
  parseCampaignSchedule,
} from './campaign-schedule';

export type CampaignTarget = {
  community_ids?: string[] | null;
  cities?: string[] | null;
  user_ids?: string[] | null;
};

export type CampaignPayload = {
  title?: string;
  body?: string;
  path?: string | null;
};

type PushTokenRow = {
  user_id: string;
  expo_push_token: string;
};

type ExpoPushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

export function parseCampaignTarget(raw: unknown): CampaignTarget {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    community_ids: asStringArray(obj.community_ids ?? obj.communities),
    cities: asStringArray(obj.cities).map((c) => c.trim()),
    user_ids: asStringArray(obj.user_ids),
  };
}

export function parseCampaignPayload(raw: unknown): CampaignPayload {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  return {
    title: typeof obj.title === 'string' ? obj.title.trim() : '',
    body: typeof obj.body === 'string' ? obj.body.trim() : '',
    path:
      typeof obj.path === 'string' && obj.path.trim()
        ? obj.path.trim()
        : null,
  };
}

/**
 * Resolve recipient user IDs for a campaign audience.
 * Same rules as banners: user_ids win; else community + city filters.
 */
export async function resolveCampaignRecipientIds(
  admin: SupabaseClient<any>,
  target: CampaignTarget,
): Promise<string[]> {
  const userIds = target.user_ids ?? [];
  if (userIds.length > 0) {
    return [...new Set(userIds)];
  }

  const communityIds = target.community_ids ?? [];
  const cities = (target.cities ?? [])
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (communityIds.length === 0 && cities.length === 0) {
    const { data, error } = await admin
      .from('push_tokens')
      .select('user_id')
      .eq('promotions_enabled', true);
    if (error) throw new Error(error.message);
    return [...new Set((data ?? []).map((r: { user_id: string }) => r.user_id))];
  }

  let communityFilterIds = communityIds;

  if (cities.length > 0) {
    const { data: cityCommunities, error: cityError } = await admin
      .from('communities')
      .select('id, city');
    if (cityError) throw new Error(cityError.message);

    const cityMatched = (cityCommunities ?? [])
      .filter((c: { id: string; city: string | null }) => {
        const city = c.city?.trim().toLowerCase() ?? '';
        return city && cities.includes(city);
      })
      .map((c: { id: string }) => c.id);

    if (communityIds.length > 0) {
      const allow = new Set(communityIds);
      communityFilterIds = cityMatched.filter((id) => allow.has(id));
    } else {
      communityFilterIds = cityMatched;
    }
  }

  if (communityFilterIds.length === 0) return [];

  const { data: addresses, error: addrError } = await admin
    .from('addresses')
    .select('customer_id, community_id')
    .in('community_id', communityFilterIds);

  if (addrError) throw new Error(addrError.message);

  return [
    ...new Set(
      (addresses ?? []).map((a: { customer_id: string }) => a.customer_id),
    ),
  ];
}

async function loadTokensForUsers(
  admin: SupabaseClient<any>,
  userIds: string[],
): Promise<PushTokenRow[]> {
  if (userIds.length === 0) return [];

  const tokens: PushTokenRow[] = [];
  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const { data, error } = await admin
      .from('push_tokens')
      .select('user_id, expo_push_token')
      .eq('promotions_enabled', true)
      .in('user_id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      tokens.push({
        user_id: row.user_id,
        expo_push_token: row.expo_push_token,
      });
    }
  }
  return tokens;
}

async function sendExpoBatch(
  messages: Array<Record<string, unknown>>,
): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Expo push failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as { data?: ExpoPushTicket[] };
    tickets.push(...(json.data ?? []));
  }
  return tickets;
}

export type SendCampaignResult = {
  campaignId: string;
  recipientUsers: number;
  tokens: number;
  sent: number;
  failed: number;
  status: 'sent' | 'failed';
};

/**
 * Send one scheduled push campaign and update its status.
 */
export async function sendPushCampaign(
  admin: SupabaseClient<any>,
  campaign: {
    id: string;
    name: string;
    target: unknown;
    payload: unknown;
  },
): Promise<SendCampaignResult> {
  const target = parseCampaignTarget(campaign.target);
  const payload = parseCampaignPayload(campaign.payload);
  const title = payload.title || campaign.name;
  const body = payload.body || '';
  const path =
    payload.path && payload.path.startsWith('/') ? payload.path : null;

  if (!body) {
    await admin
      .from('campaigns')
      .update({ status: 'failed' })
      .eq('id', campaign.id);
    return {
      campaignId: campaign.id,
      recipientUsers: 0,
      tokens: 0,
      sent: 0,
      failed: 0,
      status: 'failed',
    };
  }

  const recipientIds = await resolveCampaignRecipientIds(admin, target);
  const tokenRows = await loadTokensForUsers(admin, recipientIds);

  if (tokenRows.length === 0) {
    await admin
      .from('campaigns')
      .update({
        status: 'sent',
        sent_count: 0,
        sent_at: new Date().toISOString(),
      })
      .eq('id', campaign.id);

    return {
      campaignId: campaign.id,
      recipientUsers: recipientIds.length,
      tokens: 0,
      sent: 0,
      failed: 0,
      status: 'sent',
    };
  }

  const messages = tokenRows.map((row) => ({
    to: row.expo_push_token,
    sound: 'default',
    title,
    body,
    data: {
      campaignId: campaign.id,
      path,
    },
  }));

  let tickets: ExpoPushTicket[];
  try {
    tickets = await sendExpoBatch(messages);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Expo send failed';
    await admin
      .from('campaigns')
      .update({ status: 'failed' })
      .eq('id', campaign.id);
    throw new Error(message);
  }

  let sent = 0;
  let failed = 0;
  const invalidTokens: string[] = [];
  const now = new Date().toISOString();
  const notificationRows: Array<{
    recipient_id: string;
    channel: 'push';
    template_key: string;
    payload: Record<string, unknown>;
    status: string;
    provider_message_id: string | null;
    error: string | null;
    sent_at: string | null;
  }> = [];

  for (let i = 0; i < tokenRows.length; i++) {
    const row = tokenRows[i];
    const ticket = tickets[i];
    if (ticket?.status === 'ok') {
      sent += 1;
      notificationRows.push({
        recipient_id: row.user_id,
        channel: 'push',
        template_key: 'campaign.push',
        payload: { campaignId: campaign.id, title, body, path },
        status: 'sent',
        provider_message_id: ticket.id ?? null,
        error: null,
        sent_at: now,
      });
    } else {
      failed += 1;
      const errCode = ticket?.details?.error;
      if (errCode === 'DeviceNotRegistered') {
        invalidTokens.push(row.expo_push_token);
      }
      notificationRows.push({
        recipient_id: row.user_id,
        channel: 'push',
        template_key: 'campaign.push',
        payload: { campaignId: campaign.id, title, body, path },
        status: 'failed',
        provider_message_id: null,
        error: ticket?.message ?? errCode ?? 'unknown',
        sent_at: null,
      });
    }
  }

  if (invalidTokens.length > 0) {
    await admin.from('push_tokens').delete().in('expo_push_token', invalidTokens);
  }

  // Insert notification log in chunks (best-effort).
  for (let i = 0; i < notificationRows.length; i += 200) {
    const chunk = notificationRows.slice(i, i + 200);
    await admin.from('notifications').insert(chunk);
  }

  const status = sent > 0 || failed === 0 ? 'sent' : 'failed';
  await admin
    .from('campaigns')
    .update({
      status,
      sent_count: sent,
      sent_at: now,
    })
    .eq('id', campaign.id);

  return {
    campaignId: campaign.id,
    recipientUsers: recipientIds.length,
    tokens: tokenRows.length,
    sent,
    failed,
    status,
  };
}

/**
 * Pick due scheduled push campaigns and send them.
 * Recurring campaigns are re-queued with the next scheduled_at.
 */
export async function processDuePushCampaigns(
  admin: SupabaseClient<any>,
): Promise<{ processed: number; results: SendCampaignResult[] }> {
  const now = new Date();
  const nowIso = now.toISOString();
  const { data, error } = await admin
    .from('campaigns')
    .select('id, name, target, payload, scheduled_at, schedule, status')
    .eq('channel', 'push')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(20);

  if (error) throw new Error(error.message);

  const results: SendCampaignResult[] = [];
  for (const campaign of data ?? []) {
    // Claim to avoid double-send if cron overlaps.
    const { data: claimed, error: claimError } = await admin
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaign.id)
      .eq('status', 'scheduled')
      .select('id, name, target, payload, schedule')
      .maybeSingle();

    if (claimError) throw new Error(claimError.message);
    if (!claimed) continue;

    const result = await sendPushCampaign(admin, claimed);

    const schedule = parseCampaignSchedule(claimed.schedule);
    if (schedule && schedule.frequency !== 'once') {
      const next = computeNextScheduledAt(schedule, now, { skipCurrent: true });
      if (next) {
        await admin
          .from('campaigns')
          .update({
            status: 'scheduled',
            scheduled_at: next.toISOString(),
            sent_at: new Date().toISOString(),
            sent_count: result.sent,
          })
          .eq('id', campaign.id);
        result.status = 'sent';
      }
    }

    results.push(result);
  }

  return { processed: results.length, results };
}
