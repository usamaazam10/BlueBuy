'use client';

import * as React from 'react';
import type { StoreProduct } from '@/types/store';
import { QuantitySelector } from './quantity-selector';
import { AddToCartButton } from './add-to-cart-button';
import { Button } from '@/components/ui/button';

interface ProductPurchaseProps {
  product: StoreProduct;
}

/** Quantity + add-to-cart controls for the details page (UI only). */
export function ProductPurchase({ product }: ProductPurchaseProps) {
  const [quantity, setQuantity] = React.useState(1);
  const outOfStock = product.stock <= 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Quantity</span>
        <QuantitySelector
          value={quantity}
          onChange={setQuantity}
          max={Math.max(1, product.stock)}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <AddToCartButton
          product={product}
          quantity={quantity}
          outOfStock={outOfStock}
          openDrawerOnAdd
          variant="brand"
          size="lg"
          className="flex-1"
        />
        <Button variant="outline" size="lg" disabled={outOfStock} className="flex-1">
          Buy it now
        </Button>
      </div>
    </div>
  );
}
