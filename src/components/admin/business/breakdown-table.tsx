'use client';

/**
 * The table that accompanies every breakdown chart.
 *
 * It is not decoration: a chart with a series colour below the light-surface
 * contrast floor is only legible because an equivalent table exists, and a
 * reader who needs an exact figure should never have to hover a bar to get it.
 *
 * Cells accept `null` to mean **unknown**, which renders as "—" with a tooltip
 * rather than as `0`. That distinction is the whole point: a product with no
 * recorded cost has unknown profit, not zero profit.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BreakdownColumn<T> {
  key: string;
  header: React.ReactNode;
  /** Return `null` to render the "unknown" placeholder. */
  cell: (row: T) => React.ReactNode | null;
  align?: 'left' | 'right';
  /** Hidden below `md` to keep the table readable on a phone. */
  hideOnMobile?: boolean;
}

interface BreakdownTableProps<T> {
  columns: readonly BreakdownColumn<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  /** Rendered when there are no rows. */
  empty: React.ReactNode;
  /** Cap the visible rows, with a "show all" toggle. */
  initialRows?: number;
  className?: string;
}

export function BreakdownTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  initialRows,
  className,
}: BreakdownTableProps<T>) {
  const [expanded, setExpanded] = React.useState(false);

  if (rows.length === 0) {
    return <div className="px-5 py-10">{empty}</div>;
  }

  const limit = initialRows ?? rows.length;
  const visible = expanded ? rows : rows.slice(0, limit);
  const hidden = rows.length - visible.length;

  return (
    <div className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border bg-muted/40 border-b">
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'text-muted-foreground px-4 py-2.5 text-xs font-medium whitespace-nowrap',
                    column.align === 'right' ? 'text-right' : 'text-left',
                    column.hideOnMobile && 'hidden md:table-cell'
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {visible.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-muted/30 transition-colors">
                {columns.map((column) => {
                  const content = column.cell(row);
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        'text-foreground px-4 py-2.5',
                        column.align === 'right' && 'text-right tabular-nums',
                        column.hideOnMobile && 'hidden md:table-cell'
                      )}
                    >
                      {content === null ? <UnknownCell /> : content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-muted-foreground hover:text-foreground border-border w-full border-t px-4 py-2.5 text-xs font-medium transition-colors"
        >
          Show {hidden} more
        </button>
      )}
    </div>
  );
}

/**
 * The "unknown" placeholder. Deliberately distinct from a zero — hovering
 * explains why, so a dash is never read as "nothing sold".
 */
export function UnknownCell({ reason = 'Insufficient cost data' }: { reason?: string }) {
  return (
    <span className="text-muted-foreground" title={reason}>
      —
    </span>
  );
}
