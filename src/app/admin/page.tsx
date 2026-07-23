import Link from 'next/link';
import {
  Package,
  FolderTree,
  Tag,
  AlertTriangle,
  Plus,
  ShoppingCart,
  Users,
  FolderPlus,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/admin/ui/page-header';
import { StatCard } from '@/components/admin/ui/stat-card';
import { StatusBadge } from '@/components/admin/ui/status-badge';
import { ProductMedia } from '@/components/product/product-media';
import { ADMIN_PRODUCTS, LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { ADMIN_CATEGORIES } from '@/data/admin/categories';
import { BRANDS } from '@/data/admin/brands';
import { RECENT_ACTIVITY } from '@/data/admin/activity';
import { getBrandById } from '@/data/admin/brands';
import { formatPrice } from '@/lib/format';
import type { ActivityKind } from '@/data/admin/types';

const ACTIVITY_ICON: Record<ActivityKind, typeof Package> = {
  product: Package,
  order: ShoppingCart,
  category: FolderTree,
  brand: Tag,
  customer: Users,
};

export default function DashboardPage() {
  const lowStock = ADMIN_PRODUCTS.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length;
  const recentProducts = [...ADMIN_PRODUCTS]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

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
          value={ADMIN_PRODUCTS.length}
          icon={Package}
          trend={8.2}
          caption="vs. last month"
        />
        <StatCard
          label="Categories"
          value={ADMIN_CATEGORIES.length}
          icon={FolderTree}
          trend={0}
          caption="No change"
        />
        <StatCard
          label="Brands"
          value={BRANDS.length}
          icon={Tag}
          trend={16.7}
          caption="vs. last month"
        />
        <StatCard
          label="Low stock"
          value={lowStock}
          icon={AlertTriangle}
          trend={-4.1}
          caption="Needs restocking"
        />
      </div>

      {/* Content grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent products */}
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
          <ul className="divide-border divide-y">
            {recentProducts.map((product) => {
              const brand = getBrandById(product.brandId);
              return (
                <li key={product.id}>
                  <Link
                    href={`/admin/products/${product.id}`}
                    className="hover:bg-muted/40 flex items-center gap-3 px-5 py-3 transition-colors"
                  >
                    <span className="border-border size-10 shrink-0 overflow-hidden rounded-lg border">
                      <ProductMedia
                        seed={product.images[0] ?? product.slug}
                        accent={product.accent}
                        className="h-full w-full"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">
                        {product.title}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{brand?.name ?? '—'}</p>
                    </div>
                    <span className="text-foreground hidden text-sm font-medium tabular-nums sm:block">
                      {formatPrice(product.price)}
                    </span>
                    <StatusBadge status={product.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Recent activity */}
        <div className="border-border bg-card rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Recent activity</h2>
          </div>
          <ol className="p-5">
            {RECENT_ACTIVITY.map((item, index) => {
              const Icon = ACTIVITY_ICON[item.kind];
              const isLast = index === RECENT_ACTIVITY.length - 1;
              return (
                <li key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="border-border bg-background text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full border">
                      <Icon className="size-4" />
                    </span>
                    {!isLast && <span className="bg-border my-1 w-px flex-1" />}
                  </div>
                  <div className={isLast ? 'pb-0' : 'pb-5'}>
                    <p className="text-foreground text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-sm">{item.detail}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">{item.time}</p>
                  </div>
                </li>
              );
            })}
          </ol>
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
