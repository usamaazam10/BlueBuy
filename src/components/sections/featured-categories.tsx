'use client';

import * as React from 'react';
import Link from 'next/link';
import { useStoreCategories, useHomepage, useStoreProducts } from '@/hooks/queries';
import { optimizeImageUrl } from '@/services/cloudinary';
import { countBy } from '@/lib/product-counts';
import { Container } from '@/components/layout/container';
import { ShelfHeader } from '@/components/common/shelf-header';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';

/** Skeleton matching the round category tile footprint. */
function CategoryTileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3" aria-hidden="true">
      <div className="bg-muted/60 size-24 animate-pulse rounded-full sm:size-32 lg:size-36" />
      <div className="bg-muted/60 h-3.5 w-20 animate-pulse rounded-full" />
    </div>
  );
}

export function FeaturedCategories() {
  const { data: allCategories, isLoading, isError, refetch } = useStoreCategories();
  const { data: storeProducts } = useStoreProducts();
  const { data: homepage } = useHomepage();

  // Live product counts per category (active products only — what a shopper sees).
  const countByCategory = React.useMemo(
    () => countBy(storeProducts, 'categoryId'),
    [storeProducts]
  );

  // Honour the curated order/selection from the homepage CMS; when none is set,
  // fall back to all active categories in their own sort order.
  const categories = React.useMemo(() => {
    const ids = homepage?.featuredCategoryIds ?? [];
    if (ids.length === 0) return allCategories;
    const byId = new Map(allCategories.map((category) => [category.id, category]));
    return ids.map((id) => byId.get(id)).filter((category) => category != null);
  }, [allCategories, homepage?.featuredCategoryIds]);

  return (
    // `id` anchors the footer/hero "Explore categories" links.
    <section id="categories" className="scroll-mt-36 py-10 sm:py-12">
      <Container>
        <ShelfHeader
          title="Shop by category"
          description="Find what you need across our catalogue."
          href="/products"
          className="mb-7"
        />

        {isLoading ? (
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-6 sm:gap-x-10">
            {Array.from({ length: 5 }).map((_, index) => (
              <CategoryTileSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No categories yet"
            description="Categories will appear here once they’re added."
          />
        ) : (
          <Stagger className="flex flex-wrap justify-center gap-x-5 gap-y-7 sm:gap-x-10">
            {categories.map((category) => {
              const count = countByCategory.get(category.id) ?? 0;
              const countLabel = `${count} ${count === 1 ? 'item' : 'items'}`;
              return (
                <StaggerItem key={category.id}>
                  <Link
                    href={`/products?category=${category.slug}`}
                    className="group focus-visible:ring-ring flex w-24 flex-col items-center gap-3 rounded-2xl text-center outline-none focus-visible:ring-2 sm:w-32 lg:w-36"
                  >
                    <span className="border-border bg-secondary group-hover:border-brand group-hover:shadow-brand/15 relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 transition-all duration-300 group-hover:shadow-lg sm:size-32 lg:size-36">
                      {category.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
                        <img
                          src={
                            category.imagePublicId
                              ? optimizeImageUrl(category.imagePublicId, {
                                  width: 400,
                                  height: 400,
                                })
                              : category.image
                          }
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="size-1/2 rounded-full transition-transform duration-500 group-hover:scale-110"
                          style={{ backgroundColor: category.accent, opacity: 0.85 }}
                        />
                      )}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="group-hover:text-brand text-sm leading-tight font-semibold transition-colors sm:text-[0.94rem]">
                        {category.name}
                      </span>
                      <span className="text-muted-foreground text-xs">{countLabel}</span>
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </Container>
    </section>
  );
}
