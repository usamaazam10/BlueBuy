'use client';

import type { CartTotals } from '@/types/cart';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';

interface CartSummaryProps {
  totals: CartTotals;
  /** Extra actions rendered below the total (checkout button, view cart, …). */
  children?: React.ReactNode;
  className?: string;
}

interface RowProps {
  label: string;
  value: string;
  muted?: boolean;
  emphasis?: boolean;
}

function Row({ label, value, muted, emphasis }: RowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        emphasis ? 'text-base font-semibold' : 'text-sm',
        muted && 'text-muted-foreground'
      )}
    >
      <span>{label}</span>
      <span className={cn('tabular-nums', emphasis && 'font-semibold')}>{value}</span>
    </div>
  );
}

/**
 * Order summary — subtotal plus any active discount / shipping / tax rows and
 * the grand total. Rows appear only when the pricing engine produced them, so
 * the same component cleanly covers the subtotal-only default and a fully
 * configured cart. Reused by the drawer footer and the cart page.
 */
export function CartSummary({ totals, children, className }: CartSummaryProps) {
  const { formatPrice } = useCurrency();
  const showShipping = totals.shippingLabel !== null;
  const showTax = totals.taxLabel !== null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="space-y-2">
        <Row label="Subtotal" value={formatPrice(totals.subtotal)} />

        {totals.discount > 0 && (
          <Row
            label={totals.discountLabel ?? 'Discount'}
            value={`−${formatPrice(totals.discount)}`}
          />
        )}

        {showShipping && (
          <Row
            label={totals.shippingLabel ?? 'Shipping'}
            value={totals.freeShipping ? 'Free' : formatPrice(totals.shipping)}
          />
        )}

        {showTax && <Row label={totals.taxLabel ?? 'Tax'} value={formatPrice(totals.tax)} />}

        <div className="border-border border-t pt-3">
          <Row label="Total" value={formatPrice(totals.total)} emphasis />
        </div>
      </div>

      {/* No shipping/tax rows means the total is exactly the subtotal. Say what
          actually happens next rather than implying charges that get added
          later — delivery is agreed when we confirm the order. */}
      {!showShipping && !showTax && (
        <p className="text-muted-foreground text-xs">
          Delivery is arranged when we confirm your order.
        </p>
      )}

      {children}
    </div>
  );
}
