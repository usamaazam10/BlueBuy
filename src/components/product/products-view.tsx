'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { useStoreProducts, useStoreCategories, useStoreBrands } from '@/hooks/queries';
import type { StoreProduct } from '@/types/store';
import { BLUEBUY_COLLECTION, isCollectionProduct, isOwnLabelBrand } from '@/lib/collection';
import { cn } from '@/lib/utils';
import { ProductGrid } from './product-grid';
import { ProductGridSkeleton } from './product-grid-skeleton';
import { ErrorState } from '@/components/common/error-state';
import { EmptyState } from '@/components/common/empty-state';

type SortKey = 'featured' | 'newest' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
];

/** Sort a copy of the list by the selected key (never mutates the input). */
function sortProducts(products: StoreProduct[], sort: SortKey): StoreProduct[] {
  const sorted = [...products];
  switch (sort) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'newest':
      sorted.sort((a, b) => b.createdAtMs - a.createdAtMs);
      break;
    case 'featured':
      sorted.sort(
        (a, b) => Number(b.featured) - Number(a.featured) || b.createdAtMs - a.createdAtMs
      );
      break;
  }
  return sorted;
}

export function ProductsView() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') ?? 'all';
  const initialBrand = searchParams.get('brand') ?? 'all';

  const { data: products, isLoading, isError, refetch } = useStoreProducts();
  const { data: categories } = useStoreCategories();
  const { data: brands } = useStoreBrands();

  const [category, setCategory] = React.useState<string>(initialCategory);
  const [brand, setBrand] = React.useState<string>(initialBrand);
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<SortKey>('featured');

  // Keep the filters in sync if the query params change (e.g. nav from a card,
  // a brand tile, or the footer's BlueBuy Collection link).
  React.useEffect(() => {
    setCategory(searchParams.get('category') ?? 'all');
    setBrand(searchParams.get('brand') ?? 'all');
  }, [searchParams]);

  /** Does the catalogue contain any own-sourced (BlueBuy Collection) product? */
  const hasCollection = React.useMemo(() => products.some(isCollectionProduct), [products]);

  // BlueBuy's own label is offered as "BlueBuy Collection" instead of as a
  // third-party brand, so it must not appear twice in the dropdown.
  const thirdPartyBrands = React.useMemo(
    () => brands.filter((brand) => !isOwnLabelBrand(brand.name)),
    [brands]
  );

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    // `brand` holds a brand slug, the collection slug, or 'all'. Resolve the
    // slug to an id once rather than per product.
    const selectedBrandId =
      brand === 'all' || brand === BLUEBUY_COLLECTION.slug
        ? null
        : (brands.find((b) => b.slug === brand || b.id === brand)?.id ?? brand);

    const matched = products.filter((product) => {
      if (category !== 'all' && product.categorySlug !== category) return false;
      if (brand === BLUEBUY_COLLECTION.slug) {
        if (!isCollectionProduct(product)) return false;
      } else if (selectedBrandId && product.brandId !== selectedBrandId) return false;
      if (query) {
        const haystack =
          `${product.title} ${product.categoryName} ${product.brandName} ${product.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    return sortProducts(matched, sort);
  }, [products, brands, category, brand, search, sort]);

  return (
    <div className="flex flex-col gap-8">
      {/* Search */}
      <div className="border-border bg-background focus-within:border-brand focus-within:ring-ring/40 flex h-12 items-center gap-3 rounded-full border px-5 focus-within:ring-2">
        <Search className="text-muted-foreground size-4 shrink-0" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="placeholder:text-muted-foreground h-full w-full bg-transparent text-sm outline-none"
        />
      </div>

      {/* Filter + sort toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Filter by category"
        >
          <FilterPill active={category === 'all'} onClick={() => setCategory('all')}>
            All
          </FilterPill>
          {categories.map((c) => (
            <FilterPill key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </FilterPill>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {(thirdPartyBrands.length > 0 || hasCollection) && (
            <>
              <label htmlFor="brand" className="text-muted-foreground text-sm">
                Brand
              </label>
              <select
                id="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="border-border bg-background focus-visible:border-brand focus-visible:ring-ring/40 h-10 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2"
              >
                <option value="all">All brands</option>
                {hasCollection && (
                  <option value={BLUEBUY_COLLECTION.slug}>{BLUEBUY_COLLECTION.name}</option>
                )}
                {thirdPartyBrands.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label htmlFor="sort" className="text-muted-foreground text-sm">
            Sort
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border-border bg-background focus-visible:border-brand focus-visible:ring-ring/40 h-10 rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <ProductGridSkeleton count={8} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
          </p>

          {filtered.length > 0 ? (
            <ProductGrid products={filtered} />
          ) : products.length === 0 ? (
            <EmptyState
              title="No products yet"
              description="Our catalogue is being stocked. Please check back soon."
            />
          ) : (
            <EmptyState
              title="No matches"
              description="No products match your search and filters. Try clearing them."
            />
          )}
        </>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-foreground text-background border-foreground'
          : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
      )}
    >
      {children}
    </button>
  );
}
