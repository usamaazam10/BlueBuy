'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ShoppingBag } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps extends Omit<ButtonProps, 'children'> {
  productTitle: string;
  outOfStock?: boolean;
  label?: string;
}

/**
 * UI-only "Add to Cart". There is no cart state yet — on click it shows a
 * brief confirmation so the interaction feels complete without wiring logic.
 */
export function AddToCartButton({
  productTitle,
  outOfStock = false,
  label = 'Add to Cart',
  variant = 'primary',
  className,
  ...props
}: AddToCartButtonProps) {
  const [added, setAdded] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function handleClick() {
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
          ? `${productTitle} is out of stock`
          : added
            ? `${productTitle} added to cart`
            : `Add ${productTitle} to cart`
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
