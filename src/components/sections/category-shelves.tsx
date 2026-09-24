'use client';

import * as React from 'react';
import { useStoreCategories, useStoreProducts } from '@/hooks/queries';
import { Container } from '@/components/layout/container';
import { ShelfHeader } from '@/components/common/shelf-header';
import { ProductShelf } from '@/components/product/product-shelf';
import { Reveal } from '@/components/common/motion';

/** Products per shelf — one desktop row. */
const PER_SHELF = 5;
/** A shelf needs at least this many products to be worth showing. */
const MIN_PER_SHELF = 2;

/**
 * One product row per category ("Top picks in Toys", …) in the categories'
 * own sort order, featured products first — the marketplace pattern that makes
 * a long homepage feel full and browsable. Categories too thin to fill a row
 * are skipped.
 */
export function CategoryShelves() {
  const { data: products } = useStoreProducts();
  const { data: categories } = useStoreCategories();

  const shelves = React.useMemo(() => {
    return categories
      .map((category) => {
        const inCategory = products.filter(
          (product) => product.categoryId === category.id && product.stock > 0
        );
        const ordered = [
          ...inCategory.filter((product) => product.featured),
          ...inCategory.filter((product) => !product.featured),
        ];
        return { category, products: ordered.slice(0, PER_SHELF), total: inCategory.length };
      })
      .filter((shelf) => shelf.products.length >= MIN_PER_SHELF);
  }, [products, categories]);

  if (shelves.length === 0) return null;

  return (
    <section className="py-4 sm:py-6">
      <Container className="flex flex-col gap-12 sm:gap-14">
        {shelves.map(({ category, products: items, total }) => (
          <Reveal key={category.id}>
            <ShelfHeader
              title={`Top picks in ${category.name}`}
              description={category.description || undefined}
              href={`/products?category=${category.slug}`}
              linkLabel={total > items.length ? `View all ${total}` : 'View all'}
              className="mb-5"
            />
            <ProductShelf products={items} />
          </Reveal>
        ))}
      </Container>
    </section>
  );
}
