'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { StoreProduct } from '@/types/store';
import { useCart } from '@/context/cart-context';
import { QuantitySelector } from './quantity-selector';
import { AddToCartButton } from './add-to-cart-button';
import { Button } from '@/components/ui/button';

interface ProductPurchaseProps {
  product: StoreProduct;
}

/** Quantity + purchase controls (add to cart, buy now) for the details page. */
export function ProductPurchase({ product }: ProductPurchaseProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = React.useState(1);
  const [buyingNow, setBuyingNow] = React.useState(false);
  const outOfStock = product.stock <= 0;

  /**
   * "Buy it now" is add-to-cart plus an immediate jump to checkout — it skips
   * the cart drawer rather than bypassing the cart, so pricing and stock
   * decrementing still flow through the normal order path.
   */
  function handleBuyNow() {
    if (outOfStock || buyingNow) return;
    addItem(product, quantity);
    setBuyingNow(true);
    router.push('/checkout');
  }

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
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleBuyNow}
          disabled={outOfStock || buyingNow}
          className="flex-1"
        >
          {buyingNow ? 'Redirecting…' : 'Buy it now'}
        </Button>
      </div>
    </div>
  );
}
