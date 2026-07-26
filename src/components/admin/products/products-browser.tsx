'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2, Package, Pencil, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductMedia } from '@/components/product/product-media';
import { DataTable, type Column, type SortState } from '@/components/admin/ui/data-table';
import { Input, Select } from '@/components/admin/ui/control';
import { StatusBadge, StockBadge } from '@/components/admin/ui/status-badge';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Pagination } from '@/components/admin/ui/pagination';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { ProductRepository } from '@/repositories';
import { useCategoriesQuery, useBrandsQuery } from '@/hooks/queries';
import { LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { humanizeId } from '@/lib/mappers/store';
import { formatPrice } from '@/lib/format';
import type { FirestoreDate, Product } from '@/types/models';
import type { ProductStatus } from '@/data/admin/types';

const PAGE_SIZE = 8;

const SORT_PRESETS: Record<string, SortState> = {
  newest: { key: 'updatedAt', dir: 'desc' },
  'price-asc': { key: 'price', dir: 'asc' },
  'price-desc': { key: 'price', dir: 'desc' },
  'name-asc': { key: 'title', dir: 'asc' },
  'stock-asc': { key: 'stock', dir: 'asc' },
};

/** A flattened product row for the table (derived from the Firestore model). */
interface ProductRow {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  brandId: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status: ProductStatus;
  featured: boolean;
  thumbnailUrl: string;
  updatedAt: string;
}

/** Convert a Firestore timestamp field to a sortable ISO string. */
function toISO(date: FirestoreDate): string {
  if (!date) return new Date(0).toISOString();
  if (date instanceof Date) return date.toISOString();
  // Firestore Timestamp
  return date.toDate().toISOString();
}

/** Map a stored `Product` into the flattened row shape the table renders. */
function toRow(product: Product): ProductRow {
  const onSale = product.salePrice != null && product.salePrice < product.price;
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    categoryId: product.categoryId,
    brandId: product.brandId,
    price: onSale ? (product.salePrice as number) : product.price,
    compareAtPrice: onSale ? product.price : undefined,
    stock: product.stock,
    status: product.active ? 'active' : 'draft',
    featured: product.featured,
    thumbnailUrl: product.thumbnail || product.gallery[0]?.url || '',
    updatedAt: toISO(product.updatedAt),
  };
}

/** Extracts a comparable value for a given sort key. */
function sortValue(
  product: ProductRow,
  key: string,
  names: { category: Map<string, string>; brand: Map<string, string> }
): string | number {
  switch (key) {
    case 'price':
      return product.price;
    case 'stock':
      return product.stock;
    case 'title':
      return product.title.toLowerCase();
    case 'category':
      return (names.category.get(product.categoryId) ?? '').toLowerCase();
    case 'brand':
      return (names.brand.get(product.brandId) ?? '').toLowerCase();
    case 'status':
      return product.status;
    default:
      return product.updatedAt;
  }
}

export function ProductsBrowser() {
  const router = useRouter();
  const toast = useToast();

  // Live taxonomy for display + filtering (same Firestore source as the storefront).
  const { data: categoriesData } = useCategoriesQuery();
  const { data: brandsData } = useBrandsQuery();
  const categories = React.useMemo(
    () => [...(categoriesData ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [categoriesData]
  );
  const categoryNameById = React.useMemo(
    () => new Map((categoriesData ?? []).map((c) => [c.id, c.name])),
    [categoriesData]
  );
  const brandNameById = React.useMemo(
    () => new Map((brandsData ?? []).map((b) => [b.id, b.name])),
    [brandsData]
  );

  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [status, setStatus] = React.useState<'all' | ProductStatus>('all');
  const [sort, setSort] = React.useState<SortState>({ key: 'updatedAt', dir: 'desc' });
  const [page, setPage] = React.useState(1);
  const [toDelete, setToDelete] = React.useState<ProductRow | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Load products from Firestore (via the repository — never Firestore directly).
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    ProductRepository.list()
      .then((list) => {
        if (!active) return;
        setProducts(list.map(toRow));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load products.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Reset to the first page whenever the result set changes.
  React.useEffect(() => {
    setPage(1);
  }, [search, category, status, sort]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const names = { category: categoryNameById, brand: brandNameById };
    const result = products.filter((product) => {
      if (category !== 'all' && product.categoryId !== category) return false;
      if (status !== 'all' && product.status !== status) return false;
      if (query && !product.title.toLowerCase().includes(query) && !product.slug.includes(query))
        return false;
      return true;
    });
    result.sort((a, b) => {
      const av = sortValue(a, sort.key, names);
      const bv = sortValue(b, sort.key, names);
      if (av < bv) return sort.dir === 'asc' ? -1 : 1;
      if (av > bv) return sort.dir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [products, search, category, status, sort, categoryNameById, brandNameById]);

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

  async function handleDelete(product: ProductRow) {
    setDeletingId(product.id);
    try {
      // Deletes the Firestore document only; Cloudinary assets are left in place
      // on purpose (secure deletion needs a backend). See ProductRepository.remove.
      await ProductRepository.remove(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      toast.success('Product deleted', `“${product.title}” was removed.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete the product.';
      toast.error('Delete failed', message);
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<ProductRow>[] = [
    {
      key: 'image',
      header: '',
      className: 'w-14',
      cell: (p) => (
        <span className="border-border block size-10 overflow-hidden rounded-lg border">
          {p.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
            <img src={p.thumbnailUrl} alt={p.title} className="h-full w-full object-cover" />
          ) : (
            <ProductMedia seed={p.slug} accent="#6366f1" className="h-full w-full" />
          )}
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
          {categoryNameById.get(p.categoryId) ?? humanizeId(p.categoryId)}
        </span>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      sortable: true,
      hideOnMobile: true,
      cell: (p) => (
        <span className="text-muted-foreground">{brandNameById.get(p.brandId) ?? '—'}</span>
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
            href={`/admin/products/edit?id=${p.id}`}
            aria-label={`Edit ${p.title}`}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex size-8 items-center justify-center rounded-lg transition-colors"
          >
            <Pencil className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setToDelete(p)}
            disabled={deletingId === p.id}
            aria-label={`Delete ${p.title}`}
            className="text-muted-foreground hover:bg-destructive/10 flex size-8 items-center justify-center rounded-lg transition-colors hover:text-rose-600 disabled:opacity-50 dark:hover:text-rose-400"
          >
            {deletingId === p.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  // Initial load spinner.
  if (loading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading products…</p>
      </div>
    );
  }

  // Load failure (e.g. Firebase not configured or permission denied).
  if (loadError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load products"
        description={loadError}
        action={
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => router.refresh()}
          >
            Retry
          </Button>
        }
      />
    );
  }

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
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
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
        onRowClick={(p) => router.push(`/admin/products/edit?id=${p.id}`)}
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
          if (toDelete) void handleDelete(toDelete);
        }}
        title={`Delete ${toDelete?.title ?? 'product'}?`}
        description="This removes the product from Firestore. Its uploaded images remain in Cloudinary (secure deletion requires a backend). This action can't be undone."
        confirmLabel="Delete product"
      />
    </div>
  );
}
