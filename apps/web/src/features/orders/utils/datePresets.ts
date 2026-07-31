import { endOfDay, startOfDay, toISODate } from '@/utils/format';

export type OrderDatePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export const ORDER_DATE_PRESET_OPTIONS: { value: OrderDatePreset; label: string }[] = [
  { value: 'all', label: 'All orders' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom date' },
];

export type DateRange = {
  from: Date | null;
  to: Date | null;
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Monday-start week (local). */
function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeek(date: Date): Date {
  return endOfDay(addDays(startOfWeek(date), 6));
}

function startOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = startOfDay(date);
  d.setMonth(d.getMonth() + 1, 0);
  return endOfDay(d);
}

function startOfYear(date: Date): Date {
  const d = startOfDay(date);
  d.setMonth(0, 1);
  return d;
}

function endOfYear(date: Date): Date {
  const d = startOfDay(date);
  d.setMonth(11, 31);
  return endOfDay(d);
}

export function resolveOrderDateRange(
  preset: OrderDatePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): DateRange {
  const today = startOfDay(now);

  switch (preset) {
    case 'all':
      return { from: null, to: null };
    case 'today':
      return { from: today, to: endOfDay(today) };
    case 'yesterday': {
      const day = addDays(today, -1);
      return { from: day, to: endOfDay(day) };
    }
    case 'tomorrow': {
      const day = addDays(today, 1);
      return { from: day, to: endOfDay(day) };
    }
    case 'this_week':
      return { from: startOfWeek(today), to: endOfWeek(today) };
    case 'last_week': {
      const end = addDays(startOfWeek(today), -1);
      const start = startOfWeek(end);
      return { from: start, to: endOfDay(end) };
    }
    case 'this_month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'last_month': {
      const inLast = addDays(startOfMonth(today), -1);
      return { from: startOfMonth(inLast), to: endOfMonth(inLast) };
    }
    case 'this_year':
      return { from: startOfYear(today), to: endOfYear(today) };
    case 'custom': {
      if (!customFrom && !customTo) return { from: null, to: null };
      const from = customFrom ? startOfDay(parseLocalDate(customFrom)) : null;
      const to = customTo ? endOfDay(parseLocalDate(customTo)) : null;
      if (from && to && from.getTime() > to.getTime()) {
        return { from: startOfDay(to), to: endOfDay(from) };
      }
      return { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function dateRangeKey(
  preset: OrderDatePreset,
  customFrom?: string,
  customTo?: string,
): string {
  if (preset !== 'custom') return preset;
  return `custom:${customFrom ?? ''}:${customTo ?? ''}`;
}

export { toISODate };
