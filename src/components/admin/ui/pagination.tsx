'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Total rows and current window, for the "1–10 of 42" summary. */
  total: number;
  pageSize: number;
}

/** Builds a compact page list with ellipses, e.g. 1 … 4 5 6 … 10. */
function pageItems(page: number, pageCount: number): (number | 'ellipsis')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push('ellipsis');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < pageCount - 1) items.push('ellipsis');
  items.push(pageCount);
  return items;
}

export function Pagination({ page, pageCount, onPageChange, total, pageSize }: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-sm">
        Showing <span className="text-foreground font-medium tabular-nums">{from}</span>–
        <span className="text-foreground font-medium tabular-nums">{to}</span> of{' '}
        <span className="text-foreground font-medium tabular-nums">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="border-border text-foreground hover:bg-secondary flex size-8 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pageItems(page, Math.max(pageCount, 1)).map((item, i) =>
          item === 'ellipsis' ? (
            <span key={`e-${i}`} className="text-muted-foreground px-1.5 text-sm">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? 'page' : undefined}
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border text-sm tabular-nums transition-colors',
                item === page
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-foreground hover:bg-secondary'
              )}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="border-border text-foreground hover:bg-secondary flex size-8 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
