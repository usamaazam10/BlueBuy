'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useStoreProducts } from '@/hooks/queries';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { ProductGrid } from '@/components/product/product-grid';
import { ProductGridSkeleton } from '@/components/product/product-grid-skeleton';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export function FeaturedProducts() {
  const { data, isLoading, isError, refetch } = useStoreProducts();

  // Featured first, backfilled with the rest so the grid is never sparse.
  const products = React.useMemo(() => {
    const featured = data.filter((product) => product.featured);
    const rest = data.filter((product) => !product.featured);
    return [...featured, ...rest].slice(0, 8);
  }, [data]);

  return (
    <section className="bg-secondary/30 py-20 sm:py-24">
      <Container>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            align="left"
            eyebrow="Featured"
            title="Best of BlueBuy"
            description="Hand-picked favourites our customers love most."
            className="items-center text-center sm:items-start sm:text-left"
          />
          <Button asChild variant="outline" className="hidden shrink-0 sm:inline-flex">
            <Link href="/products">
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <ProductGridSkeleton count={8} className="mt-12" />
        ) : isError ? (
          <ErrorState className="mt-12" onRetry={refetch} />
        ) : products.length === 0 ? (
          <EmptyState
            className="mt-12"
            title="No products yet"
            description="Our catalogue is being stocked. Please check back soon."
          />
        ) : (
          <ProductGrid products={products} className="mt-12" />
        )}

        <div className="mt-10 flex justify-center sm:hidden">
          <Button asChild variant="outline">
            <Link href="/products">
              View all products <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
