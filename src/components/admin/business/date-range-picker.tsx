'use client';

/**
 * The reporting period control, plus the hook that owns period state.
 *
 * Every business page uses {@link useDateRange} so the selected period, its
 * previous-period counterpart, and the cache token all come from one place — a
 * page can't accidentally chart one window while exporting another.
 */
import * as React from 'react';
import { Select } from '@/components/admin/ui/control';
import { cn } from '@/lib/utils';
import {
  DATE_RANGE_PRESETS,
  dayKey,
  previousPeriod,
  resolveDateRange,
  type DateRange,
  type DateRangePreset,
  type ResolvedDateRange,
} from '@/lib/business/date-range';

export interface UseDateRange {
  preset: DateRangePreset;
  setPreset: (preset: DateRangePreset) => void;
  custom: { start: Date; end: Date } | null;
  setCustom: (custom: { start: Date; end: Date } | null) => void;
  /** The resolved current period. */
  range: ResolvedDateRange;
  /** The comparable preceding period. */
  previous: DateRange;
}

/**
 * Period state for a dashboard page.
 *
 * `range` is memoised on the preset and custom dates rather than on `new Date()`
 * so it stays referentially stable across re-renders — otherwise every render
 * would produce a new range object and refetch every query on the page.
 */
export function useDateRange(initial: DateRangePreset = 'last_30_days'): UseDateRange {
  const [preset, setPreset] = React.useState<DateRangePreset>(initial);
  const [custom, setCustom] = React.useState<{ start: Date; end: Date } | null>(null);

  const range = React.useMemo(
    () => resolveDateRange(preset, custom),
    // `custom` is compared by its values so a new object with the same dates
    // doesn't churn the range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preset, custom?.start.getTime(), custom?.end.getTime()]
  );

  const previous = React.useMemo(() => previousPeriod(range), [range]);

  return { preset, setPreset, custom, setCustom, range, previous };
}

/** Format a Date for an `<input type="date">`. */
function toInputValue(date: Date): string {
  return dayKey(date);
}

export function DateRangePicker({ state, className }: { state: UseDateRange; className?: string }) {
  const { preset, setPreset, custom, setCustom, range } = state;

  // Seed the custom inputs from whatever period is currently shown, so switching
  // to "Custom range" starts from what the user was already looking at.
  const startValue = toInputValue(custom?.start ?? range.start);
  const endValue = toInputValue(custom?.end ?? new Date(range.end.getTime() - 86_400_000));

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select
        aria-label="Reporting period"
        value={preset}
        onChange={(event) => {
          const next = event.target.value as DateRangePreset;
          setPreset(next);
          if (next !== 'custom') setCustom(null);
        }}
        className="w-auto min-w-40"
        compact
      >
        {DATE_RANGE_PRESETS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Start date"
            value={startValue}
            max={endValue}
            onChange={(event) => {
              const start = new Date(`${event.target.value}T00:00:00`);
              if (Number.isNaN(start.getTime())) return;
              setCustom({ start, end: custom?.end ?? start });
            }}
            className="border-border bg-background text-foreground focus-visible:border-brand focus-visible:ring-ring/30 h-9 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            aria-label="End date"
            value={endValue}
            min={startValue}
            onChange={(event) => {
              const end = new Date(`${event.target.value}T00:00:00`);
              if (Number.isNaN(end.getTime())) return;
              setCustom({ start: custom?.start ?? end, end });
            }}
            className="border-border bg-background text-foreground focus-visible:border-brand focus-visible:ring-ring/30 h-9 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
      )}
    </div>
  );
}
