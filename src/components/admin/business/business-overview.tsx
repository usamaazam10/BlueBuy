'use client';

/**
 * The business overview — the screen that answers "how is BlueBuy doing?".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads
 *
 * One orders query spans the selected period *and* its comparison period, split
 * client-side. Products, expenses and the cash ledger are one read each. That's
 * four reads for the whole screen regardless of how much history the store has,
 * because every query is either range-scoped or the (small) catalogue.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Honesty rules applied here
 *
 *  - Cost, profit and cash tiles are hidden entirely from roles without
 *    `finance.view`; a sales manager sees turnover, not margin.
 *  - Profit renders "Not enough data" — never a number — when no order in the
 *    period carries a cost snapshot.
 *  - A comparison is only shown when the previous period actually contains
 *    orders. A brand-new store shows figures with no trend arrows at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CircleDollarSign,
  Clock,
  Coins,
  Layers,
  Package,
  PackageX,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { useAuth, can } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import {
  useOrdersInRange,
  useProductsQuery,
  useExpensesQuery,
  useCashLedgerQuery,
} from '@/hooks/queries';
import {
  cashFlowSummary,
  compare,
  expensesInRange,
  formatDayLabel,
  inventoryPositions,
  inventorySummary,
  ordersInRange,
  profitAndLoss,
  salesSeries,
  topProducts,
  type DateRange,
} from '@/lib/business';
import { LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { MetricCard, DataQualityNote } from './metric-card';
import { LineChart, RankBars } from './charts';

export function BusinessOverview() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const showFinance = can(role, 'finance.view');

  const { formatPrice, currency } = useCurrency();
  const dates = useDateRange('last_30_days');
  const { range, previous } = dates;

  // One read covering both periods — see the note at the top of this file.
  const span = React.useMemo<DateRange>(
    () => ({ start: previous.start, end: range.end }),
    [previous.start, range.end]
  );

  const ordersQuery = useOrdersInRange(span);
  const productsQuery = useProductsQuery();
  const expensesQuery = useExpensesQuery(span);
  const cashQuery = useCashLedgerQuery();

  const allOrders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const allExpenses = React.useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const cashLedger = React.useMemo(() => cashQuery.data ?? [], [cashQuery.data]);

  const current = React.useMemo(() => ordersInRange(allOrders, range), [allOrders, range]);
  const prior = React.useMemo(() => ordersInRange(allOrders, previous), [allOrders, previous]);

  const currentExpenses = React.useMemo(
    () => expensesInRange(allExpenses, range),
    [allExpenses, range]
  );
  const priorExpenses = React.useMemo(
    () => expensesInRange(allExpenses, previous),
    [allExpenses, previous]
  );

  const pl = React.useMemo(
    () => profitAndLoss(current, currentExpenses),
    [current, currentExpenses]
  );
  const priorPl = React.useMemo(() => profitAndLoss(prior, priorExpenses), [prior, priorExpenses]);

  const cash = React.useMemo(() => cashFlowSummary(cashLedger, range), [cashLedger, range]);
  const priorCash = React.useMemo(
    () => cashFlowSummary(cashLedger, previous),
    [cashLedger, previous]
  );

  const positions = React.useMemo(
    () => inventoryPositions(products, allOrders, { lowStockThreshold: LOW_STOCK_THRESHOLD }),
    [products, allOrders]
  );
  const stock = React.useMemo(() => inventorySummary(positions), [positions]);

  const series = React.useMemo(() => salesSeries(current, range), [current, range]);
  const best = React.useMemo(() => topProducts(current, 'revenue', 5), [current]);

  // A comparison is only meaningful when the earlier period held activity.
  const hasPrior = prior.length > 0 || priorExpenses.length > 0;
  const hasPriorCash = priorCash.transactionCount > 0;

  const loading = ordersQuery.isLoading || productsQuery.isLoading;
  const money = (value: number) => formatPrice(value);

  const pendingOrders = current.filter((order) => order.status === 'pending').length;
  const awaitingFulfilment = allOrders.filter((order) =>
    ['pending', 'confirmed', 'processing', 'packed', 'ready_for_dispatch'].includes(order.status)
  ).length;

  return (
    <div>
      <PageHeader
        title="Business overview"
        description={`Real figures from your orders, stock and ledgers — ${range.label.toLowerCase()}.`}
        actions={<DateRangePicker state={dates} />}
      />

      {/* ── Alerts: the things that need attention today ───────────────── */}
      <AlertRow
        lowStock={stock.lowStockCount}
        outOfStock={stock.outOfStockCount}
        awaiting={awaitingFulfilment}
        uncosted={showFinance ? pl.cogs.uncostedOrders : 0}
      />

      {/* ── Sales ───────────────────────────────────────────────────────── */}
      <section className="mt-6" aria-labelledby="sales-heading">
        <h2 id="sales-heading" className="text-foreground mb-3 text-sm font-semibold">
          Sales
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gross sales"
            value={money(pl.sales.grossSales)}
            icon={CircleDollarSign}
            caption="Before discounts, excl. shipping"
            comparison={compare(pl.sales.grossSales, priorPl.sales.grossSales, hasPrior)}
            formatChange={money}
            loading={loading}
            emphasis
          />
          <MetricCard
            label="Net sales"
            value={money(pl.sales.netSales)}
            icon={TrendingUp}
            caption="After discounts and refunds"
            comparison={compare(pl.sales.netSales, priorPl.sales.netSales, hasPrior)}
            formatChange={money}
            loading={loading}
          />
          <MetricCard
            label="Orders"
            value={String(pl.sales.orderCount)}
            icon={ShoppingCart}
            caption={
              pl.sales.excludedOrderCount > 0
                ? `${pl.sales.excludedOrderCount} cancelled/returned excluded`
                : 'Excludes cancelled and returned'
            }
            comparison={compare(pl.sales.orderCount, priorPl.sales.orderCount, hasPrior)}
            loading={loading}
          />
          <MetricCard
            label="Average order value"
            value={pl.sales.averageOrderValue === null ? null : money(pl.sales.averageOrderValue)}
            unavailableReason={
              pl.sales.averageOrderValue === null ? 'No orders in this period.' : undefined
            }
            icon={Receipt}
            caption="Order value ÷ orders"
            comparison={
              pl.sales.averageOrderValue !== null && priorPl.sales.averageOrderValue !== null
                ? compare(pl.sales.averageOrderValue, priorPl.sales.averageOrderValue, hasPrior)
                : undefined
            }
            formatChange={money}
            loading={loading}
          />
        </div>

        <div className="border-border bg-card mt-4 rounded-xl border p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">Net sales over time</h3>
            <span className="text-muted-foreground text-xs">{currency}</span>
          </div>
          <LineChart
            labels={series.map((point) => formatDayLabel(point.dayKey))}
            series={[
              { label: 'Net sales', values: series.map((point) => point.netSales), slot: 1 },
            ]}
            format={money}
            ariaLabel={`Net sales per day, ${range.label}`}
            emptyMessage="No sales in this period yet."
          />
        </div>
      </section>

      {/* ── Profitability (finance roles only) ──────────────────────────── */}
      {showFinance && (
        <section className="mt-6" aria-labelledby="profit-heading">
          <h2 id="profit-heading" className="text-foreground mb-3 text-sm font-semibold">
            Costs &amp; profit
          </h2>

          {pl.dataNote && <DataQualityNote message={pl.dataNote} className="mb-3" />}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Cost of goods sold"
              value={pl.dataQuality === 'unavailable' ? null : money(pl.cogs.total)}
              unavailableReason={
                pl.dataQuality === 'unavailable'
                  ? 'No cost basis recorded for these orders yet.'
                  : undefined
              }
              icon={Coins}
              caption={
                pl.cogs.coveragePercent === null
                  ? 'Weighted average cost'
                  : `${pl.cogs.coveragePercent}% of orders costed`
              }
              polarity="lower_is_better"
              comparison={
                pl.dataQuality !== 'unavailable'
                  ? compare(pl.cogs.total, priorPl.cogs.total, hasPrior)
                  : undefined
              }
              formatChange={money}
              loading={loading}
            />
            <MetricCard
              label="Gross profit"
              value={pl.grossProfit === null ? null : money(pl.grossProfit)}
              unavailableReason={
                pl.grossProfit === null ? 'Insufficient cost data to calculate profit.' : undefined
              }
              icon={TrendingUp}
              caption="Net sales − cost of goods"
              comparison={
                pl.grossProfit !== null && priorPl.grossProfit !== null
                  ? compare(pl.grossProfit, priorPl.grossProfit, hasPrior)
                  : undefined
              }
              formatChange={money}
              loading={loading}
            />
            <MetricCard
              label="Gross margin"
              value={pl.grossMarginPercent === null ? null : `${pl.grossMarginPercent}%`}
              unavailableReason={
                pl.grossMarginPercent === null ? 'Needs both sales and cost data.' : undefined
              }
              icon={Percent}
              caption="Gross profit ÷ net sales"
              loading={loading}
            />
            <MetricCard
              label="Operating expenses"
              value={money(pl.expenses.operating)}
              icon={Receipt}
              caption={
                pl.expenses.inventoryProcurement > 0
                  ? `Excludes ${money(pl.expenses.inventoryProcurement)} of stock purchases`
                  : 'Excludes inventory purchases'
              }
              polarity="lower_is_better"
              comparison={compare(pl.expenses.operating, priorPl.expenses.operating, hasPrior)}
              formatChange={money}
              loading={loading}
            />
          </div>
        </section>
      )}

      {/* ── Cash & inventory ────────────────────────────────────────────── */}
      <section className="mt-6" aria-labelledby="position-heading">
        <h2 id="position-heading" className="text-foreground mb-3 text-sm font-semibold">
          Cash &amp; stock position
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {showFinance && (
            <>
              <MetricCard
                label="Net cash flow"
                value={money(cash.netCashFlow)}
                icon={Wallet}
                caption="Money in − money out (not revenue)"
                comparison={compare(cash.netCashFlow, priorCash.netCashFlow, hasPriorCash)}
                formatChange={money}
                loading={cashQuery.isLoading}
              />
              <MetricCard
                label="Closing cash balance"
                value={money(cash.closingBalance)}
                icon={Banknote}
                caption={`Opened at ${money(cash.openingBalance)}`}
                loading={cashQuery.isLoading}
              />
            </>
          )}
          <MetricCard
            label="Inventory value"
            value={showFinance ? money(stock.totalValue) : String(stock.totalUnits)}
            icon={Layers}
            caption={
              showFinance
                ? stock.valuationComplete
                  ? `${stock.totalUnits} units at weighted average cost`
                  : `${stock.unvaluedProducts} product${stock.unvaluedProducts === 1 ? '' : 's'} have no cost recorded`
                : `${stock.totalUnits} units in stock`
            }
            loading={productsQuery.isLoading}
          />
          <MetricCard
            label="Pending orders"
            value={String(pendingOrders)}
            icon={Clock}
            caption="Awaiting confirmation"
            polarity="neutral"
            loading={loading}
          />
          {!showFinance && (
            <MetricCard
              label="Low stock"
              value={String(stock.lowStockCount)}
              icon={AlertTriangle}
              caption={`${LOW_STOCK_THRESHOLD} or fewer in stock`}
              polarity="lower_is_better"
              loading={productsQuery.isLoading}
            />
          )}
        </div>
      </section>

      {/* ── Best sellers + recent orders ────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border-border bg-card rounded-xl border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold">Best sellers by revenue</h3>
            <Link
              href="/admin/orders"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              All orders <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <RankBars
            rows={best.map((row) => ({
              label: row.label,
              value: row.revenue,
              hint: `${row.units} unit${row.units === 1 ? '' : 's'}${
                showFinance && row.marginPercent !== null ? ` · ${row.marginPercent}% margin` : ''
              }`,
            }))}
            format={money}
            emptyMessage="No sales in this period yet."
          />
        </div>

        <div className="border-border bg-card rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h3 className="text-foreground text-sm font-semibold">Recent orders</h3>
            <Link
              href="/admin/orders"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
            >
              View all <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          {current.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders in this period"
              description="Orders placed on the storefront will appear here."
            />
          ) : (
            <ul className="divide-border divide-y">
              {current.slice(0, 6).map((order) => (
                <li key={order.id} className="flex items-center gap-3 px-5 py-3">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** The attention row: only renders the alerts that are actually live. */
function AlertRow({
  lowStock,
  outOfStock,
  awaiting,
  uncosted,
}: {
  lowStock: number;
  outOfStock: number;
  awaiting: number;
  uncosted: number;
}) {
  const alerts = [
    outOfStock > 0 && {
      href: '/admin/inventory',
      icon: PackageX,
      label: `${outOfStock} product${outOfStock === 1 ? '' : 's'} out of stock`,
      tone: 'rose' as const,
    },
    lowStock > 0 && {
      href: '/admin/inventory',
      icon: AlertTriangle,
      label: `${lowStock} product${lowStock === 1 ? '' : 's'} low on stock`,
      tone: 'amber' as const,
    },
    awaiting > 0 && {
      href: '/admin/orders',
      icon: Package,
      label: `${awaiting} order${awaiting === 1 ? '' : 's'} awaiting fulfilment`,
      tone: 'sky' as const,
    },
    uncosted > 0 && {
      href: '/admin/profit',
      icon: Coins,
      label: `${uncosted} order${uncosted === 1 ? '' : 's'} without cost data`,
      tone: 'amber' as const,
    },
  ].filter(Boolean) as {
    href: string;
    icon: typeof Package;
    label: string;
    tone: 'rose' | 'amber' | 'sky';
  }[];

  if (alerts.length === 0) return null;

  const toneClass = {
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {alerts.map((alert) => (
        <Link
          key={alert.label}
          href={alert.href}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${toneClass[alert.tone]}`}
        >
          <alert.icon className="size-3.5" aria-hidden="true" />
          {alert.label}
        </Link>
      ))}
    </div>
  );
}
