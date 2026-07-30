'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Package,
  FolderTree,
  Tag,
  AlertTriangle,
  Plus,
  FolderPlus,
  ArrowUpRight,
  Inbox,
  ShoppingCart,
  Clock,
  CircleDollarSign,
  PackageX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/ui/page-header';
import { StatCard } from '@/components/admin/ui/stat-card';
import { StatusBadge } from '@/components/admin/ui/status-badge';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { ProductMedia } from '@/components/product/product-media';
import {
  useProductsQuery,
  useCategoriesQuery,
  useBrandsQuery,
  useOrdersQuery,
} from '@/hooks/queries';
import { LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { useCurrency } from '@/hooks/use-currency';
import type { FirestoreDate, Product } from '@/types/models';

/** Coerce a Firestore timestamp (Timestamp | Date | null) to sortable millis. */
function toMillis(date: FirestoreDate): number {
  if (!date) return 0;
  if (date instanceof Date) return date.getTime();
  if (typeof (date as { toMillis?: () => number }).toMillis === 'function') {
    return (date as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * Admin dashboard — a live overview of the catalogue and recent orders.
 *
 * Everything here reads real Firestore data through the shared query hooks (the
 * same source the storefront and the rest of the admin use), so the numbers
 * always match reality. Fabricated period-over-period trends were intentionally
 * removed — there is no historical snapshot to compute them from, and showing a
 * made-up delta on a real store is misleading.
 */
export default function DashboardPage() {
  const { formatPrice } = useCurrency();
  const products = useProductsQuery();
  const categories = useCategoriesQuery();
  const brands = useBrandsQuery();
  const orders = useOrdersQuery();

  const productList = React.useMemo(() => products.data ?? [], [products.data]);
  const brandNameById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const brand of brands.data ?? []) map.set(brand.id, brand.name);
    return map;
  }, [brands.data]);

  const lowStock = productList.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length;
  const outOfStock = productList.filter((p) => p.stock === 0).length;
  const recentProducts = React.useMemo(
    () =>
      [...productList].sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)).slice(0, 5),
    [productList]
  );

  const orderList = React.useMemo(() => orders.data ?? [], [orders.data]);
  const pendingOrders = orderList.filter((o) => o.status === 'pending').length;
  // Gross revenue from every non-cancelled order (real data, not fabricated).
  const revenue = orderList
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const recentOrders = orderList.slice(0, 5);

  /** Show a dash while the underlying query is still loading. */
  const stat = (query: { isLoading: boolean }, value: number) => (query.isLoading ? '—' : value);
  const money = (query: { isLoading: boolean }, value: number) =>
    query.isLoading ? '—' : formatPrice(value);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="An overview of your catalogue and recent store activity."
        actions={
          <Button asChild size="sm" variant="brand" className="rounded-lg">
            <Link href="/admin/products/new">
              <Plus className="size-4" /> Add product
            </Link>
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total products"
          value={stat(products, productList.length)}
          icon={Package}
          caption="In your catalogue"
        />
        <StatCard
          label="Categories"
          value={stat(categories, categories.data?.length ?? 0)}
          icon={FolderTree}
          caption="Active categories"
        />
        <StatCard
          label="Brands"
          value={stat(brands, brands.data?.length ?? 0)}
          icon={Tag}
          caption="Active brands"
        />
        <StatCard
          label="Total orders"
          value={stat(orders, orderList.length)}
          icon={ShoppingCart}
          caption="All time"
        />
        <StatCard
          label="Pending orders"
          value={stat(orders, pendingOrders)}
          icon={Clock}
          caption="Awaiting confirmation"
        />
        <StatCard
          label="Revenue"
          value={money(orders, revenue)}
          icon={CircleDollarSign}
          caption="Gross, excl. cancelled"
        />
        <StatCard
          label="Low stock"
          value={stat(products, lowStock)}
          icon={AlertTriangle}
          caption={`${LOW_STOCK_THRESHOLD} or fewer in stock`}
        />
        <StatCard
          label="Out of stock"
          value={stat(products, outOfStock)}
          icon={PackageX}
          caption="Needs restocking"
        />
      </div>

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recently updated products */}
        <div className="border-border bg-card rounded-xl border lg:col-span-2">
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Recently updated</h2>
            <Link
              href="/admin/products"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {products.isLoading ? (
            <p className="text-muted-foreground px-5 py-8 text-sm">Loading products…</p>
          ) : recentProducts.length === 0 ? (
            <EmptyRow
              icon={Package}
              label="No products yet"
              action={{ href: '/admin/products/new', label: 'Add your first product' }}
            />
          ) : (
            <ul className="divide-border divide-y">
              {recentProducts.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/products/edit?id=${product.id}`}
                    className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                  >
                    <span className="border-border size-10 shrink-0 overflow-hidden rounded-lg border">
                      <ProductThumb product={product} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {product.title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {brandNameById.get(product.brandId) ?? '—'}
                      </p>
                    </div>
                    <span className="text-foreground hidden text-sm font-medium tabular-nums sm:block">
                      {formatPrice(product.price)}
                    </span>
                    <StatusBadge status={product.active ? 'active' : 'draft'} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent orders */}
        <div className="border-border bg-card rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {orders.isLoading ? (
            <p className="text-muted-foreground px-5 py-8 text-sm">Loading orders…</p>
          ) : recentOrders.length === 0 ? (
            <EmptyRow icon={Inbox} label="No orders yet" />
          ) : (
            <ul className="divide-border divide-y">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href="/admin/orders"
                    className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {order.customer.fullName}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{order.orderId}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-foreground text-sm font-medium tabular-nums">
                        {formatPrice(order.total, order.currency)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            href: '/admin/products/new',
            icon: Plus,
            label: 'New product',
            hint: 'Add a listing to your catalogue',
          },
          {
            href: '/admin/categories',
            icon: FolderPlus,
            label: 'New category',
            hint: 'Organise your products',
          },
          { href: '/admin/brands', icon: Tag, label: 'New brand', hint: 'Register a manufacturer' },
        ].map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="border-border bg-card hover:border-foreground/20 group flex items-center gap-3 rounded-xl border p-4 transition-colors"
          >
            <span className="bg-secondary text-foreground group-hover:bg-brand group-hover:text-brand-foreground flex size-9 items-center justify-center rounded-lg transition-colors">
              <action.icon className="size-4.5" />
            </span>
            <div>
              <p className="text-foreground text-sm font-medium">{action.label}</p>
              <p className="text-muted-foreground text-xs">{action.hint}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Product thumbnail: the Cloudinary image if present, else placeholder art. */
function ProductThumb({ product }: { product: Product }) {
  const src = product.thumbnail || product.gallery[0]?.url || '';
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
    return <img src={src} alt={product.title} className="h-full w-full object-cover" />;
  }
  return <ProductMedia seed={product.slug} accent="#6366f1" className="h-full w-full" />;
}

/** Shared empty state for the dashboard panels. */
function EmptyRow({
  icon: Icon,
  label,
  action,
}: {
  icon: typeof Package;
  label: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
      <Icon className="text-muted-foreground size-6" aria-hidden="true" />
      <p className="text-muted-foreground text-sm">{label}</p>
      {action && (
        <Link href={action.href} className="text-brand text-xs font-medium hover:underline">
          {action.label}
        </Link>
      )}
    </div>
  );
}
