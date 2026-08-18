/**
 * Date ranges. The half-open contract (`start <= t < end`) is what stops
 * adjacent periods double-counting the boundary instant, so it's pinned here.
 */
import { describe, expect, it } from 'vitest';
import {
  dayKey,
  eachDayKey,
  isWithin,
  parseDayKey,
  previousPeriod,
  rangeDays,
  resolveDateRange,
  toMillis,
} from './date-range';

/** Fixed "now" used across the suite: Tue 18 Aug 2026, 14:30 local. */
const NOW = new Date(2026, 7, 18, 14, 30, 0);

describe('resolveDateRange', () => {
  it('makes "today" span midnight to midnight, including right now', () => {
    const range = resolveDateRange('today', null, NOW);
    expect(range.start).toEqual(new Date(2026, 7, 18, 0, 0, 0));
    expect(range.end).toEqual(new Date(2026, 7, 19, 0, 0, 0));
    expect(isWithin(NOW, range)).toBe(true);
  });

  it('excludes the boundary instant at `end`', () => {
    const range = resolveDateRange('today', null, NOW);
    expect(isWithin(new Date(2026, 7, 18, 23, 59, 59, 999), range)).toBe(true);
    expect(isWithin(range.end, range)).toBe(false);
  });

  it('counts today in "last 7 days", giving exactly 7 days', () => {
    const range = resolveDateRange('last_7_days', null, NOW);
    expect(range.start).toEqual(new Date(2026, 7, 12, 0, 0, 0));
    expect(rangeDays(range)).toBe(7);
    expect(eachDayKey(range)).toHaveLength(7);
  });

  it('spans whole calendar months', () => {
    const range = resolveDateRange('this_month', null, NOW);
    expect(range.start).toEqual(new Date(2026, 7, 1));
    expect(range.end).toEqual(new Date(2026, 8, 1));

    const last = resolveDateRange('last_month', null, NOW);
    expect(last.start).toEqual(new Date(2026, 6, 1));
    expect(last.end).toEqual(new Date(2026, 7, 1));
  });

  it('includes the final day in full for a custom range', () => {
    const range = resolveDateRange(
      'custom',
      { start: new Date(2026, 7, 1), end: new Date(2026, 7, 3) },
      NOW
    );
    expect(range.end).toEqual(new Date(2026, 7, 4));
    expect(isWithin(new Date(2026, 7, 3, 23, 0), range)).toBe(true);
  });

  it('repairs an inverted custom range instead of returning nothing', () => {
    const range = resolveDateRange(
      'custom',
      { start: new Date(2026, 7, 10), end: new Date(2026, 7, 5) },
      NOW
    );
    expect(range.start.getTime()).toBeLessThan(range.end.getTime());
  });

  it('falls back to a sane window when custom is chosen with no dates', () => {
    const range = resolveDateRange('custom', null, NOW);
    expect(rangeDays(range)).toBe(30);
  });
});

describe('previousPeriod', () => {
  it('steps calendar presets back one calendar unit', () => {
    const prev = previousPeriod(resolveDateRange('this_month', null, NOW));
    expect(prev.start).toEqual(new Date(2026, 6, 1));
    expect(prev.end).toEqual(new Date(2026, 7, 1));
  });

  it('steps rolling ranges back by their own duration and abuts the current one', () => {
    const range = resolveDateRange('last_7_days', null, NOW);
    const prev = previousPeriod(range);
    expect(prev.end).toEqual(range.start);
    expect(rangeDays(prev)).toBe(7);
  });

  it('leaves no gap or overlap between the two periods', () => {
    const range = resolveDateRange('last_30_days', null, NOW);
    const prev = previousPeriod(range);
    const boundary = range.start;
    expect(isWithin(boundary, prev)).toBe(false);
    expect(isWithin(boundary, range)).toBe(true);
  });
});

describe('day keys', () => {
  it('uses local time so an evening date is not filed under tomorrow', () => {
    expect(dayKey(new Date(2026, 7, 18, 23, 30))).toBe('2026-08-18');
  });

  it('round-trips through parseDayKey', () => {
    expect(parseDayKey('2026-08-18')).toEqual(new Date(2026, 7, 18));
    expect(parseDayKey('nonsense')).toBeNull();
  });

  it('caps a pathological range rather than building an unbounded series', () => {
    const range = resolveDateRange(
      'custom',
      { start: new Date(2000, 0, 1), end: new Date(2026, 0, 1) },
      NOW
    );
    expect(eachDayKey(range).length).toBeLessThanOrEqual(400);
  });
});

describe('toMillis', () => {
  it('accepts Dates, Firestore Timestamps and null', () => {
    const date = new Date(2026, 7, 18);
    expect(toMillis(date)).toBe(date.getTime());
    expect(toMillis({ toMillis: () => 1234 } as never)).toBe(1234);
    expect(toMillis({ seconds: 2 } as never)).toBe(2000);
  });

  it('returns null for a pending server timestamp instead of 1970', () => {
    // A just-written doc reads back null; bucketing it at epoch 0 would drop it
    // into a 1970 bucket and quietly corrupt every date filter.
    expect(toMillis(null)).toBeNull();
    expect(toMillis(undefined)).toBeNull();
  });
});
