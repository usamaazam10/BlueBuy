import { BadgeCheck, LayoutGrid, MessageCircle, Package, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One reassurance claim. `detail` is only rendered by the `card` variant. */
export interface TrustSignal {
  id: string;
  icon: LucideIcon;
  label: string;
  detail: string;
}

/**
 * The store's canonical reassurance claims — the single source of truth.
 *
 * Every surface that reassures a shopper (homepage benefits, product detail,
 * cart, checkout) pulls from here, so a policy change is a one-line edit and the
 * storefront can never say one thing in one place and something else in another.
 *
 * **Rule for anything added here: it must describe something BlueBuy actually
 * does today.** No shipping, returns, warranty or rating claims live here,
 * because no such policy has been published — advertising one the store cannot
 * honour is worse than saying nothing. Each entry below is a statement about how
 * this store genuinely works: a hand-picked catalogue, an own-label product
 * line, direct human support, and an order flow that takes no card details.
 */
export const TRUST_SIGNALS = {
  curated: {
    id: 'curated',
    icon: BadgeCheck,
    label: 'Curated products',
    detail: 'Every item in the catalogue is chosen with quality, usefulness and value in mind.',
  },
  selection: {
    id: 'selection',
    icon: LayoutGrid,
    label: 'Wide selection',
    detail: 'Browse products across our growing range of categories and brands.',
  },
  collection: {
    id: 'collection',
    icon: Package,
    label: 'BlueBuy Collection',
    detail: 'Selected products sourced and offered directly under our own BlueBuy Collection.',
  },
  support: {
    id: 'support',
    icon: MessageCircle,
    label: 'Customer support',
    detail: 'Need help choosing a product or placing an order? Message us and we will reply.',
  },
  noPayment: {
    id: 'no-payment',
    icon: Lock,
    label: 'No card details needed',
    detail: 'We confirm your order with you and arrange payment on delivery.',
  },
} as const satisfies Record<string, TrustSignal>;

/** Key of a canonical claim in {@link TRUST_SIGNALS}. */
export type TrustSignalId = keyof typeof TRUST_SIGNALS;

interface TrustSignalsProps {
  /** Which claims to show, in order. */
  items: readonly TrustSignalId[];
  /**
   * `row` — bordered tiles, for the product page.
   * `list` — compact stacked lines, for the cart / checkout summary column.
   */
  variant?: 'row' | 'list';
  className?: string;
}

/**
 * Renders a subset of {@link TRUST_SIGNALS} at the point of hesitation.
 *
 * Intentionally quiet: muted icons, no fills or accent colour, so a strip of
 * reassurance never competes with the primary call-to-action next to it.
 */
export function TrustSignals({ items, variant = 'row', className }: TrustSignalsProps) {
  const signals = items.map((id) => TRUST_SIGNALS[id]);

  if (variant === 'list') {
    return (
      <ul className={cn('flex flex-col gap-2.5', className)}>
        {signals.map((signal) => (
          <li key={signal.id} className="text-muted-foreground flex items-center gap-2.5 text-xs">
            <signal.icon className="size-4 shrink-0" aria-hidden />
            {signal.label}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className={cn('grid grid-cols-2 gap-3', className)}>
      {signals.map((signal) => (
        <li
          key={signal.id}
          className="border-border flex items-center gap-2.5 rounded-xl border p-3 text-sm"
        >
          <signal.icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
          {signal.label}
        </li>
      ))}
    </ul>
  );
}
