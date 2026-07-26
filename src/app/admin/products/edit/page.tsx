import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditProductLoader } from '@/components/admin/products/edit-product-loader';

export const metadata: Metadata = { title: 'Edit product' };

/**
 * Product edit page.
 *
 * A **static** route (no dynamic segment) that takes the product id from the
 * `?id=` query string, so it works under `output: 'export'` for products
 * created at runtime — unlike a `[id]` route, whose params must all be known at
 * build time. `useSearchParams` requires a Suspense boundary.
 */
export default function EditProductPage() {
  return (
    <Suspense fallback={null}>
      <EditProductLoader />
    </Suspense>
  );
}
