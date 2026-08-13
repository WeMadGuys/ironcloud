/** Campaign recurrence helpers (default timezone Asia/Kolkata). */

export type CampaignFrequency = 'once' | 'daily' | 'weekly';

export type CampaignSchedule = {
  frequency: CampaignFrequency;
  /** Local time HH:mm */
  time: string;
  /** For weekly: 0=Sunday .. 6=Saturday */
  days?: number[] | null;
  /** For once: YYYY-MM-DD in the schedule timezone */
  once_date?: string | null;
  timezone?: string;
};

const DEFAULT_TZ = 'Asia/Kolkata';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse HH:mm → { hours, minutes } or null. */
export function parseTimeHm(time: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * Wall-clock parts in a timezone for an instant.
 */
export function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun .. 6=Sat
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  let hour = Number(get('hour'));
  // Some engines emit 24:00 for midnight
  if (hour === 24) hour = 0;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Convert a timezone wall time to a UTC Date.
 * Uses iterative offset correction (handles IST and DST zones).
 */
export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): Date {
  // Initial guess: treat components as UTC
  let utc = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  for (let i = 0; i < 3; i++) {
    const parts = zonedParts(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0,
      0,
    );
    const desired = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    utc += desired - asUtc;
  }
  return new Date(utc);
}

export function parseCampaignSchedule(raw: unknown): CampaignSchedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const frequency = obj.frequency;
  if (frequency !== 'once' && frequency !== 'daily' && frequency !== 'weekly') {
    return null;
  }
  const time = typeof obj.time === 'string' ? obj.time.trim() : '';
  if (!parseTimeHm(time)) return null;

  const days = Array.isArray(obj.days)
    ? obj.days.filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6)
    : [];

  return {
    frequency,
    time,
    days: frequency === 'weekly' ? days : null,
    once_date: typeof obj.once_date === 'string' ? obj.once_date : null,
    timezone:
      typeof obj.timezone === 'string' && obj.timezone.trim()
        ? obj.timezone.trim()
        : DEFAULT_TZ,
  };
}

/**
 * Compute the next fire time (UTC) at or after `from`.
 * For recurring, if `from` is exactly on a slot, returns the following occurrence
 * when `skipCurrent` is true (used after a send).
 */
export function computeNextScheduledAt(
  schedule: CampaignSchedule,
  from: Date = new Date(),
  options?: { skipCurrent?: boolean },
): Date | null {
  const tz = schedule.timezone || DEFAULT_TZ;
  const hm = parseTimeHm(schedule.time);
  if (!hm) return null;

  const skipCurrent = options?.skipCurrent === true;
  const fromParts = zonedParts(from, tz);

  if (schedule.frequency === 'once') {
    const dateStr = schedule.once_date?.trim();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const at = zonedWallTimeToUtc(y, m, d, hm.hours, hm.minutes, tz);
    if (skipCurrent) return null;
    if (at.getTime() < from.getTime() - 60_000) return null; // already past
    return at;
  }

  const days =
    schedule.frequency === 'weekly'
      ? [...new Set(schedule.days ?? [])].sort((a, b) => a - b)
      : [0, 1, 2, 3, 4, 5, 6];

  if (days.length === 0) return null;

  const baseNoon = zonedWallTimeToUtc(
    fromParts.year,
    fromParts.month,
    fromParts.day,
    12,
    0,
    tz,
  );

  for (let offset = 0; offset <= 14; offset++) {
    const dayUtc = new Date(baseNoon.getTime() + offset * 24 * 60 * 60 * 1000);
    const dayParts = zonedParts(dayUtc, tz);

    if (!days.includes(dayParts.weekday)) continue;

    const candidate = zonedWallTimeToUtc(
      dayParts.year,
      dayParts.month,
      dayParts.day,
      hm.hours,
      hm.minutes,
      tz,
    );

    if (skipCurrent) {
      if (candidate.getTime() > from.getTime()) return candidate;
    } else if (candidate.getTime() >= from.getTime() - 30_000) {
      return candidate;
    }
  }

  return null;
}

export function formatScheduleSummary(schedule: CampaignSchedule | null): string {
  if (!schedule) return '—';
  const tz = schedule.timezone || DEFAULT_TZ;
  if (schedule.frequency === 'once') {
    return `Once ${schedule.once_date ?? ''} ${schedule.time} (${tz})`.trim();
  }
  if (schedule.frequency === 'daily') {
    return `Daily at ${schedule.time} (${tz})`;
  }
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (schedule.days ?? []).map((d) => names[d] ?? d).join(', ');
  return `Weekly ${days || '—'} at ${schedule.time} (${tz})`;
}

export function scheduleToFormDefaults(schedule: CampaignSchedule | null): {
  frequency: CampaignFrequency;
  time: string;
  days: number[];
  onceDate: string;
} {
  return {
    frequency: schedule?.frequency ?? 'once',
    time: schedule?.time ?? '21:00',
    days: schedule?.days?.length ? [...schedule.days] : [1, 2, 3, 4, 5],
    onceDate: schedule?.once_date ?? '',
  };
}

export function buildSchedulePayload(input: {
  frequency: CampaignFrequency;
  time: string;
  days: number[];
  onceDate: string;
}): CampaignSchedule | null {
  const hm = parseTimeHm(input.time);
  if (!hm) return null;

  if (input.frequency === 'once') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.onceDate.trim())) return null;
    return {
      frequency: 'once',
      time: `${pad(hm.hours)}:${pad(hm.minutes)}`,
      once_date: input.onceDate.trim(),
      days: null,
      timezone: DEFAULT_TZ,
    };
  }

  if (input.frequency === 'daily') {
    return {
      frequency: 'daily',
      time: `${pad(hm.hours)}:${pad(hm.minutes)}`,
      days: null,
      timezone: DEFAULT_TZ,
    };
  }

  const days = [...new Set(input.days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (days.length === 0) return null;
  return {
    frequency: 'weekly',
    time: `${pad(hm.hours)}:${pad(hm.minutes)}`,
    days,
    timezone: DEFAULT_TZ,
  };
}
