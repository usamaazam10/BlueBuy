import { cn } from '@/lib/utils';
import type { ProductStatus } from '@/data/admin/types';

/**
 * Subtle, tinted status pills in the Linear/Stripe style — a soft coloured
 * background with a matching dot, rather than a loud solid fill.
 */

const dotBadge = 'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium';

const STATUS_STYLES: Record<ProductStatus, { label: string; className: string; dot: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  draft: {
    label: 'Draft',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/60',
  },
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={cn(dotBadge, style.className)}>
      <span className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

/** A generic active/inactive pill used by categories and brands. */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        dotBadge,
        active
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-emerald-500' : 'bg-muted-foreground/60'
        )}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/** Colour-coded stock indicator: out (red), low (amber), healthy (muted). */
export function StockBadge({ stock, threshold = 10 }: { stock: number; threshold?: number }) {
  const tone =
    stock === 0
      ? 'text-rose-600 dark:text-rose-400'
      : stock <= threshold
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground';
  const label = stock === 0 ? 'Out of stock' : stock <= threshold ? `${stock} left` : `${stock}`;
  return <span className={cn('text-sm tabular-nums', tone)}>{label}</span>;
}
