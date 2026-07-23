'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { PRODUCTS } from '@/data/products';
import { CATEGORIES } from '@/data/categories';
import { cn } from '@/lib/utils';
import { ProductGrid } from './product-grid';

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export function ProductsView() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') ?? 'all';

  const [category, setCategory] = React.useState<string>(initialCategory);
  const [sort, setSort] = React.useState<SortKey>('featured');

  // Keep the filter in sync if the query param changes (e.g. nav from a card).
  React.useEffect(() => {
    setCategory(searchParams.get('category') ?? 'all');
  }, [searchParams]);

  const filtered = React.useMemo(() => {
    const base = category === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.category === category);
    const sorted = [...base];
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
    }
    return sorted;
  }, [category, sort]);

  return (
    <div className="flex flex-col gap-8">
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
          {CATEGORIES.map((c) => (
            <FilterPill key={c.id} active={category === c.slug} onClick={() => setCategory(c.slug)}>
              {c.name}
            </FilterPill>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-3">
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

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
      </p>

      {filtered.length > 0 ? (
        <ProductGrid products={filtered} />
      ) : (
        <p className="text-muted-foreground py-16 text-center">No products in this category yet.</p>
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
