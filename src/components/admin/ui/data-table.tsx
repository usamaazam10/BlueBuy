'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  dir: SortDirection;
}

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** Cell renderer for this column. */
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  /** Extra classes applied to both the header cell and body cells. */
  className?: string;
  /** Hide the column below the `md` breakpoint to keep mobile tables tidy. */
  hideOnMobile?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  /** Controlled sort state (presentational only — the parent re-sorts `data`). */
  sort?: SortState;
  /** Called with a column key when a sortable header is activated. */
  onSortChange?: (key: string) => void;
  onRowClick?: (row: T) => void;
  /** Rendered in place of the table body when `data` is empty. */
  empty?: React.ReactNode;
  className?: string;
}

const alignClass = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const;

/**
 * A presentational, generic data table with sortable headers, responsive
 * horizontal scroll, and an empty state. Filtering, sorting and pagination are
 * owned by the parent; this component only renders the current page of rows.
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  sort,
  onSortChange,
  onRowClick,
  empty,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('border-border bg-card overflow-hidden rounded-xl border', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-border bg-muted/40 border-b">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const align = col.align ?? 'left';
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'text-muted-foreground px-4 py-3 text-xs font-medium tracking-wide whitespace-nowrap',
                      alignClass[align],
                      col.hideOnMobile && 'hidden md:table-cell',
                      col.className
                    )}
                  >
                    {col.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => onSortChange(col.key)}
                        className={cn(
                          'hover:text-foreground inline-flex items-center gap-1 transition-colors',
                          active && 'text-foreground',
                          align === 'right' && 'flex-row-reverse'
                        )}
                        aria-label={`Sort by ${typeof col.header === 'string' ? col.header : col.key}`}
                      >
                        {col.header}
                        {active ? (
                          sort?.dir === 'asc' ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-border/70 border-b transition-colors last:border-0',
                    onRowClick && 'hover:bg-muted/40 cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'text-foreground px-4 py-3 align-middle',
                        alignClass[col.align ?? 'left'],
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.className
                      )}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
