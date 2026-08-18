'use client';

/**
 * The KPI tile used across every business dashboard.
 *
 * This component is where BlueBuy's "never fabricate a number" rule is actually
 * enforced in the UI. It renders four distinct states, and they are deliberately
 * not interchangeable:
 *
 *   loading      — "—", nothing implied.
 *   unavailable  — the metric cannot be computed from real data. Shows an
 *                  explanation ("No cost data recorded"), never 0.
 *   value only   — a real figure with no prior period to compare against, so no
 *                  trend is shown at all.
 *   value+trend  — a real figure and a real, computable comparison.
 *
 * A comparison is suppressed entirely when the previous period holds no data,
 * and a percentage is suppressed when the previous value was zero (growth from
 * nothing has no percentage). Both cases come straight from `compare()`.
 */
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Comparison, MetricPolarity } from '@/lib/business/metrics';
import { isFavourable } from '@/lib/business/metrics';

export interface MetricCardProps {
  label: string;
  /** The formatted value. Pass `null` together with `unavailableReason`. */
  value: string | null;
  icon?: LucideIcon;
  /** Small caption under the value — say what the number actually means. */
  caption?: string;
  /** Period-over-period comparison. Omit to show no trend. */
  comparison?: Comparison;
  /** Whether up is good. Drives the trend colour. */
  polarity?: MetricPolarity;
  /** Formats the comparison's absolute change for the tooltip line. */
  formatChange?: (value: number) => string;
  /** Why the metric can't be shown. Renders instead of a value. */
  unavailableReason?: string;
  loading?: boolean;
  className?: string;
  /** Emphasise the tile (used for the headline metric on a page). */
  emphasis?: boolean;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  caption,
  comparison,
  polarity = 'higher_is_better',
  formatChange,
  unavailableReason,
  loading,
  className,
  emphasis,
}: MetricCardProps) {
  const showTrend =
    !loading && !unavailableReason && comparison && comparison.status !== 'unavailable';

  return (
    <div
      className={cn(
        'border-border bg-card rounded-xl border p-5',
        emphasis && 'ring-brand/20 ring-1',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {Icon && (
          <span className="border-border text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border">
            <Icon className="size-4" />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        {loading ? (
          <span className="text-muted-foreground text-2xl font-semibold tracking-tight">—</span>
        ) : unavailableReason ? (
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            Not enough data
          </span>
        ) : (
          <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
        )}

        {showTrend && <TrendPill comparison={comparison} polarity={polarity} />}
      </div>

      {unavailableReason ? (
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{unavailableReason}</p>
      ) : (
        caption && <p className="text-muted-foreground mt-1 text-xs">{caption}</p>
      )}

      {showTrend && formatChange && comparison.status === 'comparable' && (
        <p className="text-muted-foreground mt-1 text-xs">
          {comparison.change >= 0 ? '+' : '−'}
          {formatChange(Math.abs(comparison.change))} vs. previous period
        </p>
      )}
    </div>
  );
}

/** The trend chip. Renders "New" rather than a percentage when growing from zero. */
function TrendPill({ comparison, polarity }: { comparison: Comparison; polarity: MetricPolarity }) {
  const favourable = isFavourable(comparison, polarity);
  const tone =
    favourable === null
      ? 'text-muted-foreground'
      : favourable
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';

  const ArrowIcon =
    comparison.direction === 'up'
      ? ArrowUpRight
      : comparison.direction === 'down'
        ? ArrowDownRight
        : Minus;

  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5 text-xs font-medium', tone)}>
      <ArrowIcon className="size-3.5" aria-hidden="true" />
      {comparison.status === 'from_zero' ? 'New' : `${Math.abs(comparison.changePercent ?? 0)}%`}
    </span>
  );
}

/**
 * A callout for incomplete data — used above any panel whose numbers are only
 * as good as the cost coverage behind them.
 */
export function DataQualityNote({
  message,
  tone = 'warning',
  className,
}: {
  message: string;
  tone?: 'warning' | 'info';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        tone === 'warning'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-border bg-muted/40 text-muted-foreground',
        className
      )}
      role="status"
    >
      <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-pretty">{message}</span>
    </div>
  );
}
