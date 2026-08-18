'use client';

/**
 * Sales report — what sold, to what value, and where the money came from.
 *
 * Cost, profit and margin columns appear only for roles holding `finance.view`.
 * A sales manager sees turnover and units; what the business paid for the goods
 * is a separate permission.
 *
 * Note the payment-method breakdown is absent by design: BlueBuy's checkout is
 * cash-on-delivery and records no payment method on the order. How money
 * actually arrived is tracked in the cash ledger instead (Cash flow → by
 * method), which is the honest place for it — inventing a "payment method" on an
 * order that never had one would be a fabricated dimension.
 */
import * as React from 'react';
import {
  CircleDollarSign,
  Package,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { useAuth, can } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import {
  useOrdersInRange,
  useProductsQuery,
  useCategoriesQuery,
  useBrandsQuery,
} from '@/hooks/queries';
import {
  compare,
  decliningProducts,
  formatDayLabel,
  ordersInRange,
  salesByBrand,
  salesByCategory,
  salesByProduct,
  salesByStatus,
  salesMetrics,
  salesSeries,
  type DateRange,
  type SalesBreakdownRow,
} from '@/lib/business';
import { ORDER_STATUS_META } from '@/lib/order/status';
import type { OrderStatus } from '@/types/order';
import { MetricCard } from './metric-card';
import { BreakdownTable, type BreakdownColumn } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';
import { BarChart, LineChart } from './charts';

type Dimension = 'product' | 'category' | 'brand';

export function SalesBrowser() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const showFinance = can(role, 'finance.view');

  const { formatPrice } = useCurrency();
  const dates = useDateRange('last_30_days');
  const { range, previous } = dates;

  const [dimension, setDimension] = React.useState<Dimension>('product');

  // One read spanning both periods, split client-side.
  const span = React.useMemo<DateRange>(
    () => ({ start: previous.start, end: range.end }),
    [previous.start, range.end]
  );

  const ordersQuery = useOrdersInRange(span);
  const productsQuery = useProductsQuery();
  const categoriesQuery = useCategoriesQuery();
  const brandsQuery = useBrandsQuery();

  const allOrders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const current = React.useMemo(() => ordersInRange(allOrders, range), [allOrders, range]);
  const prior = React.useMemo(() => ordersInRange(allOrders, previous), [allOrders, previous]);

  const metrics = React.useMemo(() => salesMetrics(current), [current]);
  const priorMetrics = React.useMemo(() => salesMetrics(prior), [prior]);
  const hasPrior = prior.length > 0;

  const series = React.useMemo(() => salesSeries(current, range), [current, range]);

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

  const rows = React.useMemo<SalesBreakdownRow[]>(() => {
    if (dimension === 'category') return salesByCategory(current, products, categoryNames);
    if (dimension === 'brand') return salesByBrand(current, products, brandNames);
    return salesByProduct(current);
  }, [dimension, current, products, categoryNames, brandNames]);

  const byStatus = React.useMemo(() => salesByStatus(current), [current]);
  const declining = React.useMemo(() => decliningProducts(current, prior, 8), [current, prior]);
  const topByUnits = React.useMemo(
    () => [...salesByProduct(current)].sort((a, b) => b.units - a.units).slice(0, 8),
    [current]
  );

  const loading = ordersQuery.isLoading;
  const money = (value: number) => formatPrice(value);

  const breakdownColumns: BreakdownColumn<SalesBreakdownRow>[] = [
    { key: 'label', header: 'Name', cell: (row) => <span className="truncate">{row.label}</span> },
    { key: 'units', header: 'Units', align: 'right', cell: (row) => row.units },
    {
      key: 'orders',
      header: 'Orders',
      align: 'right',
      hideOnMobile: true,
      cell: (row) => row.orders,
    },
    { key: 'revenue', header: 'Revenue', align: 'right', cell: (row) => money(row.revenue) },
    ...(showFinance
      ? ([
          {
            key: 'cost',
            header: 'Cost',
            align: 'right',
            hideOnMobile: true,
            cell: (row) => (row.cost === null ? null : money(row.cost)),
          },
          {
            key: 'profit',
            header: 'Gross profit',
            align: 'right',
            cell: (row) => (row.grossProfit === null ? null : money(row.grossProfit)),
          },
          {
            key: 'margin',
            header: 'Margin',
            align: 'right',
            hideOnMobile: true,
            cell: (row) => (row.marginPercent === null ? null : `${row.marginPercent}%`),
          },
        ] as BreakdownColumn<SalesBreakdownRow>[])
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Sales"
        description="What sold in the selected period, and how it compares with the period before it."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="sales"
              range={range}
              getRows={() => rows}
              columns={[
                { header: 'Name', value: (row) => row.label },
                { header: 'Units', value: (row) => row.units },
                { header: 'Orders', value: (row) => row.orders },
                { header: 'Revenue', value: (row) => row.revenue },
                ...(showFinance
                  ? [
                      { header: 'Cost', value: (row: SalesBreakdownRow) => row.cost ?? '' },
                      {
                        header: 'Gross profit',
                        value: (row: SalesBreakdownRow) => row.grossProfit ?? '',
                      },
                      {
                        header: 'Margin %',
                        value: (row: SalesBreakdownRow) => row.marginPercent ?? '',
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Net sales"
          value={money(metrics.netSales)}
          icon={CircleDollarSign}
          caption="After discounts and refunds"
          comparison={compare(metrics.netSales, priorMetrics.netSales, hasPrior)}
          formatChange={money}
          loading={loading}
          emphasis
        />
        <MetricCard
          label="Orders"
          value={String(metrics.orderCount)}
          icon={ShoppingCart}
          caption={
            metrics.excludedOrderCount > 0
              ? `${metrics.excludedOrderCount} cancelled/returned excluded`
              : 'Excludes cancelled and returned'
          }
          comparison={compare(metrics.orderCount, priorMetrics.orderCount, hasPrior)}
          loading={loading}
        />
        <MetricCard
          label="Units sold"
          value={String(metrics.unitsSold)}
          icon={Package}
          caption="Across all lines"
          comparison={compare(metrics.unitsSold, priorMetrics.unitsSold, hasPrior)}
          loading={loading}
        />
        <MetricCard
          label="Average order value"
          value={metrics.averageOrderValue === null ? null : money(metrics.averageOrderValue)}
          unavailableReason={
            metrics.averageOrderValue === null ? 'No orders in this period.' : undefined
          }
          icon={Receipt}
          caption="Order value ÷ orders"
          loading={loading}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross sales"
          value={money(metrics.grossSales)}
          icon={TrendingUp}
          caption="Before discounts, excl. shipping"
          polarity="neutral"
          loading={loading}
        />
        <MetricCard
          label="Discounts"
          value={money(metrics.discounts)}
          icon={TrendingDown}
          caption="Given away in this period"
          polarity="neutral"
          loading={loading}
        />
        <MetricCard
          label="Shipping charged"
          value={money(metrics.shippingRevenue)}
          icon={Package}
          caption="Not counted as product revenue"
          polarity="neutral"
          loading={loading}
        />
        <MetricCard
          label="Refunds"
          value={money(metrics.refunds)}
          icon={TrendingDown}
          caption="Returned to customers"
          polarity="lower_is_better"
          loading={loading}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mb-2 text-sm font-semibold">Net sales over time</h2>
          <LineChart
            labels={series.map((point) => formatDayLabel(point.dayKey))}
            series={[
              { label: 'Net sales', values: series.map((point) => point.netSales), slot: 1 },
            ]}
            format={money}
            ariaLabel={`Net sales per day, ${range.label}`}
            emptyMessage="No sales in this period."
          />
        </div>
        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mb-2 text-sm font-semibold">Orders and units</h2>
          <BarChart
            labels={series.map((point) => formatDayLabel(point.dayKey))}
            series={[
              { label: 'Orders', values: series.map((point) => point.orders), slot: 1 },
              { label: 'Units', values: series.map((point) => point.units), slot: 2 },
            ]}
            format={(value) => String(Math.round(value))}
            ariaLabel={`Orders and units per day, ${range.label}`}
            emptyMessage="No orders in this period."
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Breakdown</h2>
          <div className="flex gap-1" role="group" aria-label="Group sales by">
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
        <BreakdownTable
          rows={rows}
          rowKey={(row) => row.key}
          initialRows={15}
          empty={
            <EmptyState
              icon={ShoppingCart}
              title="No sales in this period"
              description="Orders placed on the storefront will be broken down here."
            />
          }
          columns={breakdownColumns}
        />
      </div>

      {/* Best sellers / declining / status */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="border-border bg-card rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Best sellers by units</h2>
          </div>
          <BreakdownTable
            rows={topByUnits}
            rowKey={(row) => row.key}
            empty={<p className="text-muted-foreground px-5 py-8 text-sm">No sales yet.</p>}
            columns={[
              {
                key: 'label',
                header: 'Product',
                cell: (row) => <span className="truncate">{row.label}</span>,
              },
              { key: 'units', header: 'Units', align: 'right', cell: (row) => row.units },
            ]}
          />
        </div>

        <div className="border-border bg-card rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Declining products</h2>
            <p className="text-muted-foreground text-xs">Sold less than in the previous period.</p>
          </div>
          <BreakdownTable
            rows={declining}
            rowKey={(row) => row.key}
            empty={
              <p className="text-muted-foreground px-5 py-8 text-sm">
                Nothing declined — or there’s no earlier period to compare with yet.
              </p>
            }
            columns={[
              {
                key: 'label',
                header: 'Product',
                cell: (row) => <span className="truncate">{row.label}</span>,
              },
              {
                key: 'change',
                header: 'Change',
                align: 'right',
                cell: (row) => (
                  <span className="text-rose-600 dark:text-rose-400">{row.changePercent}%</span>
                ),
              },
            ]}
          />
        </div>

        <div className="border-border bg-card rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">By order status</h2>
          </div>
          <BreakdownTable
            rows={byStatus}
            rowKey={(row) => row.status}
            empty={<p className="text-muted-foreground px-5 py-8 text-sm">No orders yet.</p>}
            columns={[
              {
                key: 'status',
                header: 'Status',
                cell: (row) => ORDER_STATUS_META[row.status as OrderStatus]?.label ?? row.status,
              },
              { key: 'orders', header: 'Orders', align: 'right', cell: (row) => row.orders },
              {
                key: 'value',
                header: 'Value',
                align: 'right',
                hideOnMobile: true,
                cell: (row) => money(row.value),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
