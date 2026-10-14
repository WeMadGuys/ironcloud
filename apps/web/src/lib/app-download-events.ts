import { createClient } from '@supabase/supabase-js';

import { getServerSupabaseEnv } from '@/lib/server-env';

export const APP_DOWNLOAD_EVENT_TYPES = ['visit', 'app_store_click', 'play_store_click'] as const;
export const APP_DOWNLOAD_PLATFORMS = ['ios', 'android', 'desktop'] as const;

export type AppDownloadEventType = (typeof APP_DOWNLOAD_EVENT_TYPES)[number];
export type AppDownloadPlatform = (typeof APP_DOWNLOAD_PLATFORMS)[number];

const MAX_SOURCE_LENGTH = 32;

/** Best-effort insert; never throws so tracking cannot block a redirect. */
export const recordAppDownloadEvent = async ({
  eventType,
  platform,
  source,
}: {
  eventType: AppDownloadEventType;
  platform: AppDownloadPlatform;
  source?: string | null;
}): Promise<void> => {
  try {
    const { url, serviceRoleKey, missing } = getServerSupabaseEnv();
    if (missing.length) return;

    const admin = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin.from('app_download_events').insert({
      event_type: eventType,
      platform,
      source: source?.trim().slice(0, MAX_SOURCE_LENGTH) || null,
    });
    if (error) console.error('[app-download-events]', error.message);
  } catch (err) {
    console.error('[app-download-events]', err);
  }
};
