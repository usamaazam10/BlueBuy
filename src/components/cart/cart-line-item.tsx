'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { CartItem } from '@/types/cart';
import { formatPrice } from '@/lib/format';
import { lineSubtotal } from '@/lib/cart/pricing';
import { cn } from '@/lib/utils';
import { useCart } from '@/context/cart-context';
import { QuantitySelector } from '@/components/product/quantity-selector';
import { ProductImage } from '@/components/product/product-image';

interface CartLineItemProps {
  item: CartItem;
  /** `compact` for the drawer, `full` for the cart page (shows line total). */
  variant?: 'compact' | 'full';
  /** Called when the product link is followed (e.g. to close the drawer). */
  onNavigate?: () => void;
}

/**
 * A single editable cart line — image, title, unit price, quantity stepper and
 * remove control. Shared by the drawer and the cart page; `variant` tunes the
 * density and whether a per-line total is shown. Animates its own
 * enter/exit/layout so lists reflow smoothly (wrap the list in AnimatePresence).
 */
export function CartLineItem({ item, variant = 'compact', onNavigate }: CartLineItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const reduceMotion = useReducedMotion();
  const isFull = variant === 'full';

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={
        reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }
      }
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex gap-4 overflow-hidden', isFull ? 'py-5' : 'py-4')}
    >
      <Link
        href={`/product/${item.slug}`}
        onClick={onNavigate}
        className={cn(
          'bg-secondary/40 border-border shrink-0 overflow-hidden rounded-xl border',
          isFull ? 'size-24 sm:size-28' : 'size-20'
        )}
      >
        <ProductImage
          src={item.image}
          alt={item.title}
          seed={item.slug}
          accent={item.accent}
          className="h-full w-full"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/product/${item.slug}`}
              onClick={onNavigate}
              className="hover:text-brand block truncate text-sm font-medium transition-colors"
            >
              {item.title}
            </Link>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-2 text-sm">
              <span>{formatPrice(item.unitPrice)}</span>
              {item.compareAtPrice && item.compareAtPrice > item.unitPrice && (
                <span className="text-muted-foreground/70 text-xs line-through">
                  {formatPrice(item.compareAtPrice)}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            aria-label={`Remove ${item.title} from cart`}
            className="text-muted-foreground hover:bg-secondary hover:text-destructive -m-1.5 flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
          >
            <Trash2 className="size-4" />
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3">
          <QuantitySelector
            value={item.quantity}
            onChange={(q) => updateQuantity(item.id, q)}
            max={item.maxQuantity}
            className="h-9"
          />
          {isFull && (
            <span className="text-sm font-semibold tabular-nums">
              {formatPrice(lineSubtotal(item))}
            </span>
          )}
        </div>
        {item.quantity >= item.maxQuantity && (
          <p className="text-muted-foreground text-xs">Max available quantity reached.</p>
        )}
      </div>
    </motion.li>
  );
}
