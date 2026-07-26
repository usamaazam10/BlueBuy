'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditProductClient } from './edit-product-client';

/**
 * Reads the product `id` from the query string and hands it to
 * {@link EditProductClient}.
 *
 * The admin runs as a static export (`output: 'export'`), so a dynamic
 * `[id]` segment can't exist for products created at runtime — only ids known
 * at build time would be pre-generated, and everything else 500s. Using a
 * static `/admin/products/edit` route with `?id=` sidesteps that entirely: the
 * shell is prerendered once and the id is resolved on the client, so any
 * Firestore product (including ones created after the last build) is editable.
 */
export function EditProductLoader() {
  const id = useSearchParams().get('id');

  if (!id) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <span className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full">
          <AlertCircle className="size-6" />
        </span>
        <div>
          <h1 className="text-foreground text-lg font-semibold">No product selected</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Open a product from the catalogue to edit it.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="rounded-lg">
          <Link href="/admin/products">Back to products</Link>
        </Button>
      </div>
    );
  }

  return <EditProductClient id={id} />;
}
