'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { StoreProduct } from '@/types/store';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { productBrandLabel } from '@/lib/collection';
import { Badge } from '@/components/ui/badge';
import { Rating } from './rating';
import { ProductImage } from './product-image';
import { AddToCartButton } from './add-to-cart-button';

const BADGE_VARIANT = {
  Sale: 'sale',
  New: 'new',
  Featured: 'featured',
  Limited: 'limited',
} as const;

interface ProductCardProps {
  product: StoreProduct;
  className?: string;
}

function ProductCardImpl({ product, className }: ProductCardProps) {
  const reduceMotion = useReducedMotion();
  const { formatPrice } = useCurrency();
  const href = `/product/${product.slug}`;
  const outOfStock = product.stock <= 0;

  return (
    <motion.article
      whileHover={reduceMotion ? undefined : { y: -6 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'group bg-card border-border hover:shadow-foreground/5 relative flex flex-col overflow-hidden rounded-2xl border transition-shadow duration-300 hover:shadow-xl',
        className
      )}
    >
      {/* Media + full-card link */}
      <Link href={href} className="relative aspect-square overflow-hidden" tabIndex={-1}>
        <ProductImage
          src={product.thumbnail}
          alt={product.title}
          seed={product.slug}
          accent={product.accent}
          className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105"
        />
        {product.badge && (
          <Badge variant={BADGE_VARIANT[product.badge]} className="absolute top-3 left-3 shadow-sm">
            {product.badge}
          </Badge>
        )}
        {product.stock > 0 && product.stock <= 5 && (
          <span className="bg-background/80 text-foreground absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur">
            Only {product.stock} left
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {product.categoryName || product.category.replace('-', ' ')}
          </span>
          <h3 className="leading-snug font-medium">
            <Link
              href={href}
              className="focus-visible:ring-ring rounded-sm outline-none after:absolute after:inset-0 focus-visible:ring-2"
            >
              {product.title}
            </Link>
          </h3>
          {/* Brand, or the BlueBuy Collection for products we source ourselves. */}
          <span className="text-muted-foreground text-xs">{productBrandLabel(product)}</span>
        </div>

        <Rating value={product.rating} reviewCount={product.reviewCount} />

        <div className="mt-auto flex items-center gap-2 pt-1">
          <span className="text-lg font-semibold">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-muted-foreground text-sm line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>

        {/* Above the card link so it stays clickable */}
        <AddToCartButton
          product={product}
          outOfStock={outOfStock}
          variant="outline"
          size="sm"
          className="relative z-10 mt-1 w-full"
        />
      </div>
    </motion.article>
  );
}

/** Memoised so grids of cards don't re-render when unrelated state changes. */
export const ProductCard = React.memo(ProductCardImpl);
