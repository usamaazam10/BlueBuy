'use client';

/**
 * Product, category and brand performance.
 *
 * This is the only screen that shows demand and supply side by side — what
 * customers looked at, what they bought, and what is left on the shelf. The
 * insight panels below the table are the point of it: a ranked table tells you
 * what happened, the panels tell you what to do about it.
 *
 * Conversion and margin columns render "—" rather than a number wherever the
 * underlying data can't support one (too few views, no captured cost).
 */
import * as React from 'react';
import {
  Boxes,
  Eye,
  EyeOff,
  Flame,
  PackageX,
  Percent,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { useAuth, can } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import {
  useAnalyticsWindow,
  useOrdersInRange,
  useProductsQuery,
  useCategoriesQuery,
  useBrandsQuery,
} from '@/hooks/queries';
import {
  groupPerformance,
  performanceInsights,
  productPerformance,
  type GroupPerformance,
  type ProductPerformance,
} from '@/lib/business';
import { LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { MetricCard, DataQualityNote } from './metric-card';
import { BreakdownTable, type BreakdownColumn } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';

type Dimension = 'product' | 'category' | 'brand';

export function PerformanceBrowser() {
  const { user } = useAuth();
  const showFinance = can(user?.role ?? 'viewer', 'finance.view');

  const { formatPrice } = useCurrency();
  const dates = useDateRange('last_30_days');
  const [dimension, setDimension] = React.useState<Dimension>('product');

  const ordersQuery = useOrdersInRange(dates.range);
  const productsQuery = useProductsQuery();
  const categoriesQuery = useCategoriesQuery();
  const brandsQuery = useBrandsQuery();
  const analyticsQuery = useAnalyticsWindow(dates.range);

  const orders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const events = React.useMemo(() => analyticsQuery.data?.events ?? [], [analyticsQuery.data]);
  const neverTracked = analyticsQuery.data?.neverTracked ?? false;

  const rows = React.useMemo(
    () => productPerformance(products, orders, events),
    [products, orders, events]
  );

  const insights = React.useMemo(
    () => performanceInsights(rows, { lowStockThreshold: LOW_STOCK_THRESHOLD }),
    [rows]
  );

  const categoryNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categoriesQuery.data]);

  const brandNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const brand of brandsQuery.data ?? []) map.set(brand.id, brand.name);
    return map;
  }, [brandsQuery.data]);

  const groups = React.useMemo<GroupPerformance[]>(() => {
    if (dimension === 'category') {
      return groupPerformance(rows, (row) => row.categoryId, categoryNames);
    }
    if (dimension === 'brand') {
      return groupPerformance(rows, (row) => row.brandId, brandNames);
    }
    return [];
  }, [dimension, rows, categoryNames, brandNames]);

  const productRows = React.useMemo(
    () => [...rows].sort((a, b) => b.revenue - a.revenue || b.views - a.views),
    [rows]
  );

  const loading = ordersQuery.isLoading || productsQuery.isLoading;
  const money = (value: number) => formatPrice(value);

  const totalViews = rows.reduce((sum, row) => sum + row.views, 0);
  const totalUnits = rows.reduce((sum, row) => sum + row.units, 0);
  const withoutViews = rows.filter((row) => row.views === 0).length;

  const productColumns: BreakdownColumn<ProductPerformance>[] = [
    {
      key: 'title',
      header: 'Product',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.title}</p>
          <p className="text-muted-foreground truncate text-xs">{row.slug}</p>
        </div>
      ),
    },
    { key: 'views', header: 'Views', align: 'right', cell: (row) => row.views },
    {
      key: 'carts',
      header: 'Added to cart',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => row.addToCarts,
    },
    { key: 'units', header: 'Units sold', align: 'right', cell: (row) => row.units },
    { key: 'revenue', header: 'Revenue', align: 'right', cell: (row) => money(row.revenue) },
    ...(showFinance
      ? ([
          {
            key: 'profit',
            header: 'Gross profit',
            align: 'right',
            hideOnMobile: true,
            cell: (row) => (row.grossProfit === null ? null : money(row.grossProfit)),
          },
          {
            key: 'margin',
            header: 'Margin',
            align: 'right',
            hideOnMobile: true,
            cell: (row) => (row.marginPercent === null ? null : `${row.marginPercent}%`),
          },
        ] as BreakdownColumn<ProductPerformance>[])
      : []),
    { key: 'stock', header: 'Stock', align: 'right', cell: (row) => row.stock },
    {
      key: 'conversion',
      header: 'Conversion',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => (row.conversionRate === null ? null : `${row.conversionRate}%`),
    },
  ];

  const groupColumns: BreakdownColumn<GroupPerformance>[] = [
    { key: 'label', header: 'Name', cell: (row) => <span className="truncate">{row.label}</span> },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => row.products,
    },
    { key: 'views', header: 'Views', align: 'right', cell: (row) => row.views },
    { key: 'units', header: 'Units', align: 'right', cell: (row) => row.units },
    { key: 'revenue', header: 'Revenue', align: 'right', cell: (row) => money(row.revenue) },
    ...(showFinance
      ? ([
          {
            key: 'profit',
            header: 'Gross profit',
            align: 'right',
            hideOnMobile: true,
            cell: (row) => (row.grossProfit === null ? null : money(row.grossProfit)),
          },
          {
            key: 'margin',
            header: 'Margin',
            align: 'right',
            cell: (row) => (row.marginPercent === null ? null : `${row.marginPercent}%`),
          },
        ] as BreakdownColumn<GroupPerformance>[])
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Product performance"
        description="Demand and supply side by side — what customers viewed, what sold, and what's left."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="product-performance"
              range={dates.range}
              getRows={() => productRows}
              columns={[
                { header: 'Product', value: (row) => row.title },
                { header: 'Views', value: (row) => row.views },
                { header: 'View sessions', value: (row) => row.viewSessions },
                { header: 'Added to cart', value: (row) => row.addToCarts },
                { header: 'Orders', value: (row) => row.orders },
                { header: 'Units sold', value: (row) => row.units },
                { header: 'Revenue', value: (row) => row.revenue },
                ...(showFinance
                  ? [
                      { header: 'Cost', value: (row: ProductPerformance) => row.cost ?? '' },
                      {
                        header: 'Gross profit',
                        value: (row: ProductPerformance) => row.grossProfit ?? '',
                      },
                      {
                        header: 'Margin %',
                        value: (row: ProductPerformance) => row.marginPercent ?? '',
                      },
                      {
                        header: 'Unit cost',
                        value: (row: ProductPerformance) => row.unitCost ?? '',
                      },
                      {
                        header: 'Inventory value',
                        value: (row: ProductPerformance) => row.inventoryValue ?? '',
                      },
                    ]
                  : []),
                { header: 'Stock', value: (row) => row.stock },
                { header: 'Conversion %', value: (row) => row.conversionRate ?? '' },
              ]}
            />
          </div>
        }
      />

      {neverTracked && (
        <DataQualityNote
          className="mb-4"
          tone="info"
          message="No storefront analytics recorded yet, so view and conversion columns are empty. Sales figures below are real. Views will start appearing as customers browse the store."
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Product views"
          value={String(totalViews)}
          icon={Eye}
          caption="Across the catalogue"
          polarity="neutral"
          loading={analyticsQuery.isLoading}
        />
        <MetricCard
          label="Units sold"
          value={String(totalUnits)}
          icon={ShoppingCart}
          caption="In this period"
          polarity="neutral"
          loading={loading}
        />
        <MetricCard
          label="Products with no views"
          value={String(withoutViews)}
          icon={EyeOff}
          caption="Nobody opened these"
          polarity="lower_is_better"
          loading={analyticsQuery.isLoading}
        />
        <MetricCard
          label="Dead stock lines"
          value={String(insights.deadStock.length)}
          icon={PackageX}
          caption="In stock, nothing sold"
          polarity="lower_is_better"
          loading={loading}
        />
      </div>

      {/* Main table */}
      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Performance</h2>
          <div className="flex gap-1" role="group" aria-label="Group performance by">
            {(['product', 'category', 'brand'] as Dimension[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDimension(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  dimension === option
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                aria-pressed={dimension === option}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {dimension === 'product' ? (
          <BreakdownTable
            rows={productRows}
            rowKey={(row) => row.productId}
            initialRows={15}
            empty={
              <EmptyState
                icon={Boxes}
                title="No products yet"
                description="Add products to your catalogue to see how they perform."
              />
            }
            columns={productColumns}
          />
        ) : (
          <BreakdownTable
            rows={groups}
            rowKey={(row) => row.key}
            initialRows={15}
            empty={
              <EmptyState
                icon={Boxes}
                title="Nothing to group yet"
                description="Assign products to categories and brands to see rolled-up performance."
              />
            }
            columns={groupColumns}
          />
        )}
      </div>

      {/* Insights */}
      <h2 className="text-foreground mt-8 mb-3 text-sm font-semibold">What to act on</h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <InsightPanel
          icon={Flame}
          title="Low stock, selling well"
          hint="Reorder these first."
          rows={insights.lowStockBestSellers}
          render={(row) => `${row.units} sold · ${row.stock} left`}
          emptyMessage="Nothing urgent — no best seller is running low."
        />
        <InsightPanel
          icon={Eye}
          title="Viewed but not bought"
          hint="Plenty of interest, no sales. Check price, photos and description."
          rows={insights.viewedNotBought}
          render={(row) => `${row.views} views · 0 sold`}
          emptyMessage="No product is getting significant interest without selling."
        />
        <InsightPanel
          icon={PackageX}
          title="Dead stock"
          hint="Sitting in stock with no sales this period."
          rows={insights.deadStock}
          render={(row) =>
            row.inventoryValue === null
              ? `${row.stock} in stock`
              : `${row.stock} in stock · ${money(row.inventoryValue)} tied up`
          }
          emptyMessage="Everything in stock sold at least once."
        />
        <InsightPanel
          icon={TrendingUp}
          title="Highest revenue"
          rows={insights.bestSellers}
          render={(row) => money(row.revenue)}
          emptyMessage="No sales in this period."
        />
        {showFinance && (
          <InsightPanel
            icon={Percent}
            title="Highest margin"
            hint="Among products with a recorded cost."
            rows={insights.highestMargin}
            render={(row) => `${row.marginPercent}% margin`}
            emptyMessage="No products with both sales and recorded costs yet."
          />
        )}
        <InsightPanel
          icon={EyeOff}
          title="Never viewed"
          hint="In the catalogue, but nobody has opened them."
          rows={insights.noViews}
          render={(row) => `${row.stock} in stock`}
          emptyMessage="Every product has been viewed at least once."
        />
      </div>
    </div>
  );
}

/** A small ranked list with a one-line explanation of why it matters. */
function InsightPanel({
  icon: Icon,
  title,
  hint,
  rows,
  render,
  emptyMessage,
}: {
  icon: typeof Eye;
  title: string;
  hint?: string;
  rows: readonly ProductPerformance[];
  render: (row: ProductPerformance) => string;
  emptyMessage: string;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-5">
      <div className="flex items-start gap-2.5">
        <span className="border-border text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg border">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-semibold">{title}</h3>
          {hint && <p className="text-muted-foreground text-xs text-pretty">{hint}</p>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground mt-4 text-sm text-pretty">{emptyMessage}</p>
      ) : (
        <ul className="divide-border mt-3 divide-y">
          {rows.map((row) => (
            <li key={row.productId} className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-foreground truncate text-sm">{row.title}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {render(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
