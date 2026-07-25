import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/types/order';
import { ORDER_STATUS_META, type OrderStatusMeta } from '@/lib/order/status';

/**
 * Tinted status pill for orders, in the same subtle Linear/Stripe style as the
 * product {@link StatusBadge}: a soft coloured background with a matching dot.
 * Colours come from the status metadata's `tone` (see `@/lib/order/status`).
 */

const dotBadge =
  'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

const TONE_STYLES: Record<OrderStatusMeta['tone'], { className: string; dot: string }> = {
  amber: { className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  sky: { className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  violet: {
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  indigo: {
    className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  emerald: {
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  rose: { className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status];
  const tone = TONE_STYLES[meta.tone];
  return (
    <span className={cn(dotBadge, tone.className)}>
      <span className={cn('size-1.5 rounded-full', tone.dot)} />
      {meta.label}
    </span>
  );
}
