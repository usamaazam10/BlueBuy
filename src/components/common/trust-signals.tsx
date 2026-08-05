import { Truck, RotateCcw, ShieldCheck, Headphones, Lock } from 'lucide-react';
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
 * storefront can never advertise "30-day returns" in one place and "14-day" in
 * another.
 *
 * Claims are deliberately limited to what this store actually offers. Note there
 * is no "secure payment" claim: checkout takes no card details at all, which is
 * why `noPayment` states that outright rather than implying a payment gateway.
 */
export const TRUST_SIGNALS = {
  shipping: {
    id: 'shipping',
    icon: Truck,
    label: 'Free, fast shipping',
    detail: 'Complimentary carbon-neutral delivery on every order, worldwide.',
  },
  returns: {
    id: 'returns',
    icon: RotateCcw,
    label: '30-day returns',
    detail: 'Changed your mind? Send it back within 30 days, no questions asked.',
  },
  warranty: {
    id: 'warranty',
    icon: ShieldCheck,
    label: '2-year warranty',
    detail: 'Every product is backed by our comprehensive, hassle-free warranty.',
  },
  support: {
    id: 'support',
    icon: Headphones,
    label: 'Human support',
    detail: 'Real people, ready to help you 7 days a week via chat or email.',
  },
  noPayment: {
    id: 'no-payment',
    icon: Lock,
    label: 'No card details needed',
    detail: 'We confirm your order and arrange payment on delivery.',
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
