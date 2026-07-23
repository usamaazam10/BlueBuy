'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Package, Pencil, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductMedia } from '@/components/product/product-media';
import { DataTable, type Column, type SortState } from '@/components/admin/ui/data-table';
import { Input, Select } from '@/components/admin/ui/control';
import { StatusBadge, StockBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Pagination } from '@/components/admin/ui/pagination';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { ADMIN_PRODUCTS, LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { ADMIN_CATEGORIES } from '@/data/admin/categories';
import { getBrandById } from '@/data/admin/brands';
import { getAdminCategoryBySlug } from '@/data/admin/categories';
import { formatPrice } from '@/lib/format';
import type { AdminProduct, ProductStatus } from '@/data/admin/types';

const PAGE_SIZE = 8;

const SORT_PRESETS: Record<string, SortState> = {
  newest: { key: 'updatedAt', dir: 'desc' },
  'price-asc': { key: 'price', dir: 'asc' },
  'price-desc': { key: 'price', dir: 'desc' },
  'name-asc': { key: 'title', dir: 'asc' },
  'stock-asc': { key: 'stock', dir: 'asc' },
};

/** Extracts a comparable value for a given sort key. */
function sortValue(product: AdminProduct, key: string): string | number {
  switch (key) {
    case 'price':
      return product.price;
    case 'stock':
      return product.stock;
    case 'title':
      return product.title.toLowerCase();
    case 'category':
      return product.category;
    case 'brand':
      return getBrandById(product.brandId)?.name ?? '';
    case 'status':
      return product.status;
    default:
      return product.updatedAt;
  }
}

export function ProductsBrowser() {
  const router = useRouter();
  const [products, setProducts] = React.useState<AdminProduct[]>(ADMIN_PRODUCTS);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [status, setStatus] = React.useState<'all' | ProductStatus>('all');
  const [sort, setSort] = React.useState<SortState>({ key: 'updatedAt', dir: 'desc' });
  const [page, setPage] = React.useState(1);
  const [toDelete, setToDelete] = React.useState<AdminProduct | null>(null);

  // Reset to the first page whenever the result set changes.
  React.useEffect(() => {
    setPage(1);
  }, [search, category, status, sort]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = products.filter((product) => {
      if (category !== 'all' && product.category !== category) return false;
      if (status !== 'all' && product.status !== status) return false;
      if (query && !product.title.toLowerCase().includes(query) && !product.slug.includes(query))
        return false;
      return true;
    });
    result.sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [products, search, category, status, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );

  const hasFilters = search !== '' || category !== 'all' || status !== 'all';
  const clearFilters = () => {
    setSearch('');
    setCategory('all');
    setStatus('all');
  };

  const columns: Column<AdminProduct>[] = [
    {
      key: 'image',
      header: '',
      className: 'w-14',
      cell: (p) => (
        <span className="border-border block size-10 overflow-hidden rounded-lg border">
          <ProductMedia seed={p.images[0] ?? p.slug} accent={p.accent} className="h-full w-full" />
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Product',
      sortable: true,
      cell: (p) => (
        <div className="min-w-0">
          <p className="text-foreground truncate font-medium">{p.title}</p>
          <p className="text-muted-foreground truncate text-xs">/{p.slug}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      hideOnMobile: true,
      cell: (p) => (
        <span className="text-muted-foreground">
          {getAdminCategoryBySlug(p.category)?.name ?? p.category}
        </span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      sortable: true,
      hideOnMobile: true,
      cell: (p) => (
        <span className="text-muted-foreground">{getBrandById(p.brandId)?.name ?? '—'}</span>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      align: 'right',
      cell: (p) => (
        <div className="tabular-nums">
          <span className="text-foreground font-medium">{formatPrice(p.price)}</span>
          {p.compareAtPrice && (
            <span className="text-muted-foreground ml-1.5 text-xs line-through">
              {formatPrice(p.compareAtPrice)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      sortable: true,
      align: 'right',
      hideOnMobile: true,
      cell: (p) => <StockBadge stock={p.stock} threshold={LOW_STOCK_THRESHOLD} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'w-24',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/admin/products/${p.id}`}
            aria-label={`Edit ${p.title}`}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setToDelete(p)}
            aria-label={`Delete ${p.title}`}
            className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 dark:hover:text-rose-400"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
            className="sm:w-40"
          >
            <option value="all">All categories</option>
            {ADMIN_CATEGORIES.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | ProductStatus)}
            aria-label="Filter by status"
            className="sm:w-36"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </Select>
          <Select
            value={
              Object.keys(SORT_PRESETS).find(
                (k) => SORT_PRESETS[k].key === sort.key && SORT_PRESETS[k].dir === sort.dir
              ) ?? ''
            }
            onChange={(e) => {
              const preset = SORT_PRESETS[e.target.value];
              if (preset) setSort(preset);
            }}
            aria-label="Sort products"
            className="sm:w-40"
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="stock-asc">Stock: Low to High</option>
          </Select>
        </div>
      </div>

      {hasFilters && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <X className="size-3.5" /> Clear filters
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={pageRows}
        rowKey={(p) => p.id}
        sort={sort}
        onSortChange={toggleSort}
        onRowClick={(p) => router.push(`/admin/products/${p.id}`)}
        empty={
          <EmptyState
            icon={Package}
            title="No products found"
            description={
              hasFilters
                ? 'No products match your filters. Try adjusting or clearing them.'
                : 'Get started by adding your first product.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button asChild size="sm" variant="brand" className="rounded-lg">
                  <Link href="/admin/products/new">Add product</Link>
                </Button>
              )
            }
          />
        }
      />

      {filtered.length > 0 && (
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={setPage}
          total={filtered.length}
          pageSize={PAGE_SIZE}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) setProducts((prev) => prev.filter((p) => p.id !== toDelete.id));
        }}
        title={`Delete ${toDelete?.title ?? 'product'}?`}
        description="This product will be removed from the catalogue. This action can't be undone."
        confirmLabel="Delete product"
      />
    </div>
  );
}
