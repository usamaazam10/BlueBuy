'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { TrustSignals } from '@/components/common/trust-signals';
import { CartEmpty } from './cart-empty';
import { CartLineItem } from './cart-line-item';
import { CartSummary } from './cart-summary';

/**
 * Full cart page: an editable line-item list beside a sticky order summary.
 * Shares its line item, summary and empty-state primitives with the drawer, so
 * the two surfaces can never drift apart. Client-only because it reads the cart
 * context and localStorage-backed state.
 */
export function CartView() {
  const { items, totals, itemCount, isEmpty, hydrated, clear } = useCart();

  // Avoid a flash of the empty state before localStorage has been read.
  if (!hydrated) {
    return (
      <Container className="py-20">
        <div className="text-muted-foreground animate-pulse text-sm">Loading your cart…</div>
      </Container>
    );
  }

  if (isEmpty) {
    return (
      <Container className="py-12 sm:py-16">
        <h1 className="mb-8 text-3xl font-semibold sm:text-4xl">Your cart</h1>
        <div className="border-border rounded-3xl border">
          <CartEmpty />
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-12 sm:py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Your cart</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {itemCount} {itemCount === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-muted-foreground hover:text-destructive flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <Trash2 className="size-4" /> Clear cart
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        {/* Line items */}
        <div>
          <ul className="divide-border border-border divide-y border-t">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <CartLineItem key={item.id} item={item} variant="full" />
              ))}
            </AnimatePresence>
          </ul>

          <div className="mt-6">
            <Button asChild variant="ghost" className="text-muted-foreground -ml-3">
              <Link href="/products">
                <ArrowLeft className="size-4" /> Continue shopping
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary */}
        <motion.aside
          layout
          className="bg-card border-border h-fit rounded-2xl border p-6 lg:sticky lg:top-24"
        >
          <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
          <CartSummary totals={totals}>
            <div className="space-y-2 pt-2">
              <Button asChild variant="brand" size="lg" className="w-full">
                <Link href="/checkout">Proceed to checkout</Link>
              </Button>
              <p className="text-muted-foreground text-center text-xs">
                No payment is taken online.
              </p>
            </div>
            <TrustSignals
              variant="list"
              items={['noPayment', 'support']}
              className="border-border mt-4 border-t pt-4"
            />
          </CartSummary>
        </motion.aside>
      </div>
    </Container>
  );
}
