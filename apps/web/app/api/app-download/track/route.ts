import { NextResponse } from 'next/server';

import {
  APP_DOWNLOAD_EVENT_TYPES,
  APP_DOWNLOAD_PLATFORMS,
  recordAppDownloadEvent,
  type AppDownloadEventType,
  type AppDownloadPlatform,
} from '@/lib/app-download-events';

/** Public endpoint used by the /get-app page (sent via navigator.sendBeacon). */
export async function POST(req: Request) {
  let body: { eventType?: string; platform?: string; source?: string | null };
  try {
    body = JSON.parse(await req.text()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const eventType = body.eventType as AppDownloadEventType;
  const platform = body.platform as AppDownloadPlatform;
  if (!APP_DOWNLOAD_EVENT_TYPES.includes(eventType) || !APP_DOWNLOAD_PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });
  }

  await recordAppDownloadEvent({
    eventType,
    platform,
    source: typeof body.source === 'string' ? body.source : null,
  });

  return new NextResponse(null, { status: 204 });
}
