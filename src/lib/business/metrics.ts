/**
 * Metric primitives — rounding, and honest period-over-period comparison.
 *
 * The comparison type here exists to enforce one of BlueBuy's hard rules: a
 * dashboard must never invent a trend. A percentage change is only meaningful
 * when there is a real prior period to compare against, and "up 100%" from a
 * base of zero is not information — it's noise. {@link compare} encodes those
 * cases explicitly so the UI renders "no comparison" instead of a made-up delta.
 */

/**
 * Round money to 2 decimal places, killing binary-float drift.
 *
 * Amounts are summed all over the reporting layer (`0.1 + 0.2` problems
 * compound quickly across hundreds of lines), so every computed total passes
 * through here before it is displayed or stored.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Round a percentage/ratio to one decimal place. */
export function roundPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** Sum a list of numbers, ignoring non-finite entries, rounded as money. */
export function sumMoney(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (Number.isFinite(value)) total += value;
  }
  return roundMoney(total);
}

/**
 * Safe division: returns `null` rather than `Infinity`/`NaN` when the
 * denominator is zero. Callers render `null` as "not enough data".
 */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/** A ratio expressed as a percentage, or `null` when it isn't computable. */
export function percentOf(part: number, whole: number): number | null {
  const ratio = safeDivide(part, whole);
  return ratio === null ? null : roundPercent(ratio * 100);
}

/** Which way a metric moved. */
export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * The outcome of comparing a metric against its previous period.
 *
 * `status` is what the UI switches on:
 *  - `comparable`  — both periods have data; `changePercent` is a real number.
 *  - `from_zero`   — the previous period was zero, so a percentage is undefined.
 *                    Render "new" (or the absolute value), never a percentage.
 *  - `unavailable` — there is no prior period data at all. Render nothing.
 */
export type ComparisonStatus = 'comparable' | 'from_zero' | 'unavailable';

export interface Comparison {
  status: ComparisonStatus;
  current: number;
  previous: number;
  /** Absolute change (current − previous). Zero when not comparable. */
  change: number;
  /** Percentage change, or `null` unless `status === 'comparable'`. */
  changePercent: number | null;
  direction: TrendDirection;
}

/**
 * Compare a metric with its previous period.
 *
 * @param current       The metric in the selected period.
 * @param previous      The same metric in the preceding period.
 * @param hasPriorData  Whether the previous period contains any underlying
 *                      records at all. This is the crucial input: a store that
 *                      simply didn't exist last month must show no comparison,
 *                      which is different from a month that genuinely sold zero.
 */
export function compare(current: number, previous: number, hasPriorData: boolean): Comparison {
  const change = roundMoney(current - previous);

  if (!hasPriorData) {
    return {
      status: 'unavailable',
      current,
      previous,
      change: 0,
      changePercent: null,
      direction: 'flat',
    };
  }

  const direction: TrendDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

  // A previous value of zero makes the percentage undefined (division by zero).
  // Reporting "+100%" or "+∞%" here would be a fabricated figure.
  if (previous === 0) {
    return {
      status: current === 0 ? 'comparable' : 'from_zero',
      current,
      previous,
      change,
      changePercent: current === 0 ? 0 : null,
      direction,
    };
  }

  return {
    status: 'comparable',
    current,
    previous,
    change,
    changePercent: roundPercent((change / Math.abs(previous)) * 100),
    direction,
  };
}

/**
 * Whether a higher value is good for this metric. Expenses and COGS going up is
 * bad; sales going up is good — the KPI card needs to know which colour to use.
 */
export type MetricPolarity = 'higher_is_better' | 'lower_is_better' | 'neutral';

/** Whether a comparison should read as positive, given the metric's polarity. */
export function isFavourable(comparison: Comparison, polarity: MetricPolarity): boolean | null {
  if (comparison.direction === 'flat' || polarity === 'neutral') return null;
  const up = comparison.direction === 'up';
  return polarity === 'higher_is_better' ? up : !up;
}
