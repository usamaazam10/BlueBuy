/**
 * Date ranges — the single source of truth for "what period am I looking at?".
 *
 * Every business report filters through this module, so a KPI card, a chart and
 * a CSV export of the same period can never disagree about where that period
 * starts and ends.
 *
 * Conventions:
 *  - A range is **half-open**: `start <= t < end`. This makes adjacent periods
 *    tile perfectly with no double-counted boundary instant.
 *  - Ranges are computed in the **viewer's local timezone**, because the person
 *    reading the dashboard thinks in their own "today", not in UTC.
 *  - `end` for "today" is the start of tomorrow, so an order placed a second ago
 *    is inside today's range.
 */
import type { FirestoreDate } from '@/types/models';

/** Selectable reporting periods. */
export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'custom';

export const DATE_RANGE_PRESETS: readonly { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

/** A half-open period: `start <= t < end`. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** A range plus how it was chosen, for labelling and comparison logic. */
export interface ResolvedDateRange extends DateRange {
  preset: DateRangePreset;
  label: string;
}

// ───────────────────────────── Day helpers ───────────────────────────────────

/** Midnight at the start of `date`'s local day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Midnight at the start of the day `days` after `date`. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Midnight on the 1st of `date`'s local month. */
export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Midnight on the 1st of the month `months` after `date`. */
export function addMonths(date: Date, months: number): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Midnight on 1 January of `date`'s local year. */
export function startOfYear(date: Date): Date {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Local-time day bucket, `YYYY-MM-DD`.
 *
 * Deliberately built from local getters rather than `toISOString()`, which would
 * shift the day for anyone east or west of UTC and silently file evening orders
 * under tomorrow.
 */
export function dayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse a `YYYY-MM-DD` day key back into local midnight. Invalid → `null`. */
export function parseDayKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// ─────────────────────── Firestore timestamp coercion ────────────────────────

/**
 * Coerce a Firestore timestamp (`Timestamp | Date | null`) to epoch millis, or
 * `null` when there is no usable value.
 *
 * A pending `serverTimestamp()` reads back as `null` on a just-written document;
 * returning `null` (rather than 0) keeps such a record out of date filters
 * instead of dumping it into 1970.
 */
export function toMillis(value: FirestoreDate | undefined): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const candidate = value as { toMillis?: () => number; seconds?: number };
  if (typeof candidate.toMillis === 'function') return candidate.toMillis();
  if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  return null;
}

/** Coerce a Firestore timestamp to a `Date`, or `null` when unavailable. */
export function toDate(value: FirestoreDate | undefined): Date | null {
  const millis = toMillis(value);
  return millis === null ? null : new Date(millis);
}

/** Whether a Firestore timestamp falls inside a half-open range. */
export function isWithin(value: FirestoreDate | undefined, range: DateRange): boolean {
  const millis = toMillis(value);
  if (millis === null) return false;
  return millis >= range.start.getTime() && millis < range.end.getTime();
}

// ──────────────────────────── Range resolution ───────────────────────────────

/**
 * Turn a preset (plus an optional custom span) into a concrete range.
 *
 * `custom` is inclusive of both dates as the user picked them — the returned
 * `end` is pushed to the start of the following day so the last day counts in
 * full. Passing `custom` with any other preset is ignored.
 */
export function resolveDateRange(
  preset: DateRangePreset,
  custom?: { start: Date; end: Date } | null,
  now: Date = new Date()
): ResolvedDateRange {
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return { preset, label: 'Today', start: today, end: addDays(today, 1) };

    case 'yesterday':
      return { preset, label: 'Yesterday', start: addDays(today, -1), end: today };

    case 'last_7_days':
      // Inclusive of today, so "last 7 days" spans today and the 6 before it.
      return { preset, label: 'Last 7 days', start: addDays(today, -6), end: addDays(today, 1) };

    case 'last_30_days':
      return { preset, label: 'Last 30 days', start: addDays(today, -29), end: addDays(today, 1) };

    case 'this_month':
      return {
        preset,
        label: 'This month',
        start: startOfMonth(now),
        end: addMonths(now, 1),
      };

    case 'last_month':
      return {
        preset,
        label: 'Last month',
        start: addMonths(now, -1),
        end: startOfMonth(now),
      };

    case 'this_year':
      return {
        preset,
        label: 'This year',
        start: startOfYear(now),
        end: addDays(today, 1),
      };

    case 'custom': {
      if (!custom) {
        // Fall back to a sane window rather than an empty or inverted range.
        return resolveDateRange('last_30_days', null, now);
      }
      const start = startOfDay(custom.start);
      const end = addDays(startOfDay(custom.end), 1);
      // Guard an inverted selection so downstream filters can't silently return
      // nothing: swap rather than throw, the UI has already accepted the input.
      const ordered = start <= end ? { start, end } : { start: end, end: start };
      return {
        preset,
        label: `${dayKey(ordered.start)} → ${dayKey(addDays(ordered.end, -1))}`,
        ...ordered,
      };
    }
  }
}

/**
 * The comparable period immediately before `range`.
 *
 * Calendar presets step back by one calendar unit (this month → last month,
 * this year → last year) so month-lengths line up the way an owner expects.
 * Everything else steps back by the range's own duration.
 */
export function previousPeriod(range: ResolvedDateRange): DateRange {
  switch (range.preset) {
    case 'this_month':
    case 'last_month':
      return { start: addMonths(range.start, -1), end: range.start };
    case 'this_year': {
      const start = new Date(range.start);
      start.setFullYear(start.getFullYear() - 1);
      const end = new Date(range.end);
      end.setFullYear(end.getFullYear() - 1);
      return { start, end };
    }
    default: {
      const duration = range.end.getTime() - range.start.getTime();
      return { start: new Date(range.start.getTime() - duration), end: range.start };
    }
  }
}

/**
 * Every local day in a range, as `YYYY-MM-DD` keys — the x-axis for time series.
 *
 * Capped at {@link MAX_SERIES_DAYS} so a pathological custom range can't build a
 * multi-thousand-point chart in the browser.
 */
export const MAX_SERIES_DAYS = 400;

export function eachDayKey(range: DateRange): string[] {
  const keys: string[] = [];
  let cursor = startOfDay(range.start);
  const end = range.end.getTime();
  while (cursor.getTime() < end && keys.length < MAX_SERIES_DAYS) {
    keys.push(dayKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

/** Whole days spanned by a range (at least 1). */
export function rangeDays(range: DateRange): number {
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

/** Short human label for a date, e.g. "17 Aug". */
export function formatDayLabel(key: string): string {
  const date = parseDayKey(key);
  if (!date) return key;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

/** Full human label for a date, e.g. "17 Aug 2026". */
export function formatDate(value: FirestoreDate | Date | undefined | null): string {
  const date = value instanceof Date ? value : toDate(value as FirestoreDate);
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Date + time label, for audit trails and movement history. */
export function formatDateTime(value: FirestoreDate | Date | undefined | null): string {
  const date = value instanceof Date ? value : toDate(value as FirestoreDate);
  if (!date) return '—';
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
