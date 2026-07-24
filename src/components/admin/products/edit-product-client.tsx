'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductRepository } from '@/repositories';
import type { Product } from '@/types/models';
import { ProductForm } from './product-form';
import { productToFormValues } from './product-mappers';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'ready'; product: Product };

/**
 * Loads a product from Firestore (via the repository) on the client, then hands
 * it to {@link ProductForm} for editing. Client-side because the data is live —
 * the static-export shell is prerendered, but the record is fetched at runtime.
 */
export function EditProductClient({ id }: { id: string }) {
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  React.useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    ProductRepository.getById(id)
      .then((product) => {
        if (!active) return;
        setState(product ? { status: 'ready', product } : { status: 'not-found' });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'The product could not be loaded.';
        setState({ status: 'error', message });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading product…</p>
      </div>
    );
  }

  if (state.status === 'error' || state.status === 'not-found') {
    const isError = state.status === 'error';
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <AlertCircle className="size-6" />
        </span>
        <div>
          <h1 className="text-foreground text-lg font-semibold">
            {isError ? 'Could not load product' : 'Product not found'}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isError
              ? state.message
              : 'This product may have been deleted, or the link is out of date.'}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="rounded-lg">
          <Link href="/admin/products">Back to products</Link>
        </Button>
      </div>
    );
  }

  return <ProductForm mode="edit" initial={productToFormValues(state.product)} productId={id} />;
}
