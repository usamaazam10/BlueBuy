'use client';

import * as React from 'react';
import { useStoreProducts, useHomepage } from '@/hooks/queries';
import { Container } from '@/components/layout/container';
import { ShelfHeader } from '@/components/common/shelf-header';
import { ProductGrid } from '@/components/product/product-grid';
import { ProductGridSkeleton } from '@/components/product/product-grid-skeleton';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils';

export function FeaturedProducts() {
  const { data, isLoading, isError, refetch } = useStoreProducts();
  const { data: homepage } = useHomepage();

  // Prefer the homepage CMS's curated product ids (in order). When none are
  // set, fall back to `featured`-flagged products, backfilled with the rest so
  // the grid is never sparse.
  const products = React.useMemo(() => {
    const ids = homepage?.featuredProductIds ?? [];
    if (ids.length > 0) {
      const byId = new Map(data.map((product) => [product.id, product]));
      const picked = ids.map((id) => byId.get(id)).filter((product) => product != null);
      if (picked.length > 0) return picked.slice(0, 10);
    }
    const featured = data.filter((product) => product.featured);
    const rest = data.filter((product) => !product.featured);
    return [...featured, ...rest].slice(0, 10);
  }, [data, homepage?.featuredProductIds]);

  return (
    <section className="py-8 sm:py-10">
      <Container>
        <ShelfHeader
          title="Featured products"
          description="A hand-picked selection from the BlueBuy catalogue."
          href="/products"
          className="mb-6"
        />

        {isLoading ? (
          <ProductGridSkeleton count={8} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : products.length === 0 ? (
          <EmptyState
            title="No products yet"
            description="Our catalogue is being stocked. Please check back soon."
          />
        ) : (
          <ProductGrid
            products={products}
            className={cn(
              'grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4',
              // Five-up only when it fills whole rows (curated lists cap at 8).
              products.length % 5 === 0 && 'xl:grid-cols-5'
            )}
          />
        )}
      </Container>
    </section>
  );
}
