'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useStoreCategories, useHomepage, useStoreProducts } from '@/hooks/queries';
import { optimizeImageUrl } from '@/services/cloudinary';
import { countBy } from '@/lib/product-counts';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { Stagger, StaggerItem } from '@/components/common/motion';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/lib/utils';

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
    <section id="categories" className="scroll-mt-24 py-20 sm:py-24">
      <Container>
        <SectionTitle
          eyebrow="Browse"
          title="Shop by category"
          description="Find what you need across the categories in our catalogue."
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
            {categories.map((category) => {
              const count = countByCategory.get(category.id) ?? 0;
              const countLabel = `${count} ${count === 1 ? 'item' : 'items'}`;
              const hasImage = Boolean(category.image);
              return (
                <StaggerItem key={category.id}>
                  <Link
                    href={`/products?category=${category.slug}`}
                    className="group border-border hover:shadow-foreground/5 focus-visible:ring-ring relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {hasImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export */}
                        <img
                          src={
                            category.imagePublicId
                              ? optimizeImageUrl(category.imagePublicId, {
                                  width: 400,
                                  height: 400,
                                })
                              : (category.image as string)
                          }
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <span
                          aria-hidden
                          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
                        />
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                    <span
                      className={cn(
                        'relative mt-auto flex items-center justify-between',
                        hasImage && 'text-white'
                      )}
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">{category.name}</span>
                        <span
                          className={cn(
                            'text-xs',
                            hasImage ? 'text-white/80' : 'text-muted-foreground'
                          )}
                        >
                          {countLabel}
                        </span>
                      </span>
                      <ArrowUpRight
                        className={cn(
                          'size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5',
                          hasImage ? 'text-white/90' : 'text-muted-foreground'
                        )}
                      />
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
