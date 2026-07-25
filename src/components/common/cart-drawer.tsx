'use client';

import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useCart } from '@/context/cart-context';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { CartEmpty, CartLineItem, CartSummary } from '@/components/cart';

/**
 * Slide-over cart. Reads everything from the cart context, so it stays in sync
 * with adds from anywhere in the storefront and survives reloads via
 * localStorage. Open state also lives in the context, letting "Add to cart"
 * pop the drawer open.
 */
export function CartDrawer() {
  const { items, totals, itemCount, isEmpty, drawerOpen, closeDrawer, clear } = useCart();

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      title={itemCount > 0 ? `Your Cart (${itemCount})` : 'Your Cart'}
    >
      {isEmpty ? (
        <CartEmpty onNavigate={closeDrawer} />
      ) : (
        <>
          <ul className="divide-border flex-1 divide-y overflow-y-auto px-5">
            <AnimatePresence initial={false}>
              {items.map((item) => (
                <CartLineItem key={item.id} item={item} onNavigate={closeDrawer} />
              ))}
            </AnimatePresence>
          </ul>

          <footer className="border-border space-y-4 border-t p-5">
            <CartSummary totals={totals} />
            <div className="space-y-2">
              <Button asChild variant="brand" size="lg" className="w-full" onClick={closeDrawer}>
                <Link href="/checkout">Checkout</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full" onClick={closeDrawer}>
                <Link href="/cart">View cart</Link>
              </Button>
              <button
                type="button"
                onClick={clear}
                className="text-muted-foreground hover:text-destructive mx-auto flex items-center gap-1.5 text-xs font-medium transition-colors"
              >
                <Trash2 className="size-3.5" /> Clear cart
              </button>
            </div>
          </footer>
        </>
      )}
    </Drawer>
  );
}
