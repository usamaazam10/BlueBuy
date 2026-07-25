'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CartEmptyProps {
  /** Called when the shopper follows the "Browse products" link (e.g. close drawer). */
  onNavigate?: () => void;
  className?: string;
}

/** Shared empty-cart state used by both the drawer and the cart page. */
export function CartEmpty({ onNavigate, className }: CartEmptyProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center',
        className
      )}
    >
      <motion.span
        initial={reduceMotion ? false : { scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="bg-secondary text-muted-foreground flex size-20 items-center justify-center rounded-full"
      >
        <ShoppingBag className="size-8" />
      </motion.span>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Your cart is empty</p>
        <p className="text-muted-foreground text-sm text-pretty">
          Looks like you haven’t added anything yet. Let’s fix that.
        </p>
      </div>
      <Button asChild variant="brand" onClick={onNavigate}>
        <Link href="/products">Browse products</Link>
      </Button>
    </div>
  );
}
