'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { PRODUCTS } from '@/data/products';
import { formatPrice } from '@/lib/format';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { QuantitySelector } from '@/components/product/quantity-selector';
import { ProductMedia } from '@/components/product/product-media';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface CartLine {
  productId: string;
  quantity: number;
}

// UI-only sample lines so the drawer demonstrates a populated cart. There is no
// real cart state in this phase; these reset when the drawer remounts.
const SAMPLE_LINES: CartLine[] = [
  { productId: 'p-01', quantity: 1 },
  { productId: 'p-07', quantity: 2 },
];

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const [lines, setLines] = React.useState<CartLine[]>(SAMPLE_LINES);

  const items = lines
    .map((line) => {
      const product = PRODUCTS.find((p) => p.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((item): item is CartLine & { product: (typeof PRODUCTS)[number] } => item !== null);

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function updateQuantity(productId: string, quantity: number) {
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  return (
    <Drawer open={open} onClose={onClose} title="Your Cart">
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="bg-secondary flex size-16 items-center justify-center rounded-full">
            <ShoppingBag className="text-muted-foreground size-7" />
          </span>
          <div>
            <p className="font-medium">Your cart is empty</p>
            <p className="text-muted-foreground text-sm">Add some products to get started.</p>
          </div>
          <Button asChild variant="outline" onClick={onClose}>
            <Link href="/products">Browse products</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="divide-border flex-1 divide-y overflow-y-auto px-5">
            {items.map((item) => (
              <li key={item.productId} className="flex gap-4 py-4">
                <Link
                  href={`/product/${item.product.slug}`}
                  onClick={onClose}
                  className="bg-secondary/40 border-border size-20 shrink-0 overflow-hidden rounded-xl border"
                >
                  <ProductMedia
                    seed={item.product.images[0]}
                    accent={item.product.accent}
                    className="h-full w-full"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.product.title}</p>
                      <p className="text-muted-foreground text-sm">
                        {formatPrice(item.product.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(item.productId)}
                      aria-label={`Remove ${item.product.title}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <QuantitySelector
                    value={item.quantity}
                    onChange={(q) => updateQuantity(item.productId, q)}
                    className="h-9 self-start"
                  />
                </div>
              </li>
            ))}
          </ul>

          <footer className="border-border border-t p-5">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <p className="text-muted-foreground mb-4 text-xs">
              Shipping and taxes calculated at checkout.
            </p>
            <Button variant="brand" size="lg" className="w-full">
              Checkout
            </Button>
          </footer>
        </>
      )}
    </Drawer>
  );
}
