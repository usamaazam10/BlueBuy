'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Product } from '@/types';
import { cn } from '@/lib/utils';
import { ProductMedia } from './product-media';

interface ProductGalleryProps {
  product: Product;
}

/** Large primary image with selectable thumbnails. */
export function ProductGallery({ product }: ProductGalleryProps) {
  const [active, setActive] = React.useState(0);
  const images = product.images;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-secondary/40 border-border relative aspect-square overflow-hidden rounded-3xl border">
        <AnimatePresence mode="wait">
          <motion.div
            key={images[active]}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full w-full"
          >
            <ProductMedia
              seed={images[active]}
              accent={product.accent}
              detailed
              className="h-full w-full"
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div className="flex gap-3" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`View image ${index + 1}`}
              onClick={() => setActive(index)}
              className={cn(
                'bg-secondary/40 focus-visible:ring-ring relative aspect-square w-20 overflow-hidden rounded-xl border-2 transition-colors outline-none focus-visible:ring-2',
                index === active ? 'border-brand' : 'hover:border-border border-transparent'
              )}
            >
              <ProductMedia seed={image} accent={product.accent} className="h-full w-full" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
