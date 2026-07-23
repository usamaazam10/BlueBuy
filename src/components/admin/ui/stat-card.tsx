import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Optional period-over-period delta, e.g. 12.5 for +12.5%. */
  trend?: number;
  /** Small caption under the value, e.g. "vs. last month". */
  caption?: string;
}

/** A single dashboard statistic tile. */
export function StatCard({ label, value, icon: Icon, trend, caption }: StatCardProps) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        <span className="border-border text-muted-foreground flex size-8 items-center justify-center rounded-lg border">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {typeof trend === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trendUp
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {caption && <p className="text-muted-foreground mt-1 text-xs">{caption}</p>}
    </div>
  );
}
