'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useStoreCategories, useHomepage } from '@/hooks/queries';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';

/** Skeleton tile matching the category card footprint. */
function CategoryTileSkeleton() {
  return (
    <div
      className="border-border bg-muted/40 aspect-square animate-pulse rounded-2xl border"
      aria-hidden="true"
    />
  );
}

export function FeaturedCategories() {
  const { data: allCategories, isLoading, isError, refetch } = useStoreCategories();
  const { data: homepage } = useHomepage();

  // Honour the curated order/selection from the homepage CMS; when none is set,
  // fall back to all active categories in their own sort order.
  const categories = React.useMemo(() => {
    const ids = homepage?.featuredCategoryIds ?? [];
    if (ids.length === 0) return allCategories;
    const byId = new Map(allCategories.map((category) => [category.id, category]));
    return ids.map((id) => byId.get(id)).filter((category) => category != null);
  }, [allCategories, homepage?.featuredCategoryIds]);

  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionTitle
          eyebrow="Browse"
          title="Shop by category"
          description="Find exactly what you need across our curated collections."
        />

        {isLoading ? (
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <CategoryTileSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState className="mt-12" onRetry={refetch} />
        ) : categories.length === 0 ? (
          <EmptyState
            className="mt-12"
            title="No categories yet"
            description="Categories will appear here once they’re added."
          />
        ) : (
          <Stagger className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((category) => (
              <StaggerItem key={category.id}>
                <Link
                  href={`/products?category=${category.slug}`}
                  className="group border-border hover:shadow-foreground/5 focus-visible:ring-ring relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="absolute -top-6 -right-6 size-20 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-150"
                    style={{ backgroundColor: category.accent, opacity: 0.25 }}
                  />
                  <span
                    aria-hidden
                    className="size-9 rounded-xl"
                    style={{ backgroundColor: category.accent, opacity: 0.9 }}
                  />
                  <span className="relative flex items-center justify-between">
                    <span className="text-sm font-semibold">{category.name}</span>
                    <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Container>
    </section>
  );
}
