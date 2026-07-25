'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ShoppingBag } from 'lucide-react';
import type { CartAddable } from '@/types/cart';
import { useCart } from '@/context/cart-context';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps extends Omit<ButtonProps, 'children'> {
  /** Product to add — any catalogue product satisfies this shape. */
  product: CartAddable;
  /** Quantity to add per click (details page passes the chosen amount). */
  quantity?: number;
  outOfStock?: boolean;
  label?: string;
  /** Slide the cart drawer open after a successful add. */
  openDrawerOnAdd?: boolean;
}

/**
 * Adds a product to the cart and confirms with a brief inline "Added" state.
 * The real cart mutation lives in the cart context; this component only owns the
 * transient confirmation animation.
 */
export function AddToCartButton({
  product,
  quantity = 1,
  outOfStock = false,
  label = 'Add to Cart',
  openDrawerOnAdd = false,
  variant = 'primary',
  className,
  ...props
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function handleClick() {
    if (outOfStock) return;
    addItem(product, quantity, { openDrawer: openDrawerOnAdd });
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1600);
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleClick}
      disabled={outOfStock}
      aria-live="polite"
      aria-label={
        outOfStock
          ? `${product.title} is out of stock`
          : added
            ? `${product.title} added to cart`
            : `Add ${product.title} to cart`
      }
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        {outOfStock ? (
          <motion.span key="oos" className="inline-flex items-center gap-2">
            Out of Stock
          </motion.span>
        ) : added ? (
          <motion.span
            key="added"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2"
          >
            <Check /> Added
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="inline-flex items-center gap-2"
          >
            <ShoppingBag /> {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
