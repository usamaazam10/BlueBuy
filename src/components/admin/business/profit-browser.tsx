'use client';

/**
 * Profitability — the P&L, and where profit actually comes from.
 *
 * The statement is rendered as an explicit, labelled sequence rather than a grid
 * of tiles, because the *order of operations* is the point: net sales less cost
 * of goods gives gross profit; gross profit less operating expenses gives
 * operating profit. Presenting them as unordered KPIs is how "revenue" and
 * "profit" end up being used interchangeably.
 *
 * Every figure withholds itself when its inputs are unknown — see `dataQuality`.
 */
import * as React from 'react';
import { AlertTriangle, Coins, Percent, Receipt, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useCurrency } from '@/hooks/use-currency';
import {
  useOrdersInRange,
  useExpensesQuery,
  useProductsQuery,
  useCategoriesQuery,
  useBrandsQuery,
  useCaptureOrderCosts,
} from '@/hooks/queries';
import {
  compare,
  expensesInRange,
  ordersInRange,
  profitAndLoss,
  salesByBrand,
  salesByCategory,
  salesByProduct,
  type DateRange,
  type SalesBreakdownRow,
} from '@/lib/business';
import { MetricCard, DataQualityNote } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';

type Dimension = 'product' | 'category' | 'brand';

export function ProfitBrowser() {
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const dates = useDateRange('this_month');
  const { range, previous } = dates;

  const [dimension, setDimension] = React.useState<Dimension>('product');

  const span = React.useMemo<DateRange>(
    () => ({ start: previous.start, end: range.end }),
    [previous.start, range.end]
  );

  const ordersQuery = useOrdersInRange(span);
  const expensesQuery = useExpensesQuery(span);
  const productsQuery = useProductsQuery();
  const categoriesQuery = useCategoriesQuery();
  const brandsQuery = useBrandsQuery();
  const captureCosts = useCaptureOrderCosts();

  const allOrders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const allExpenses = React.useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

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
  const hasPrior = prior.length > 0 || priorExpenses.length > 0;

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

  /** Orders in the period that still have no cost snapshot. */
  const uncosted = React.useMemo(
    () => current.filter((order) => !order.costing && order.status !== 'cancelled'),
    [current]
  );

  const money = (value: number) => formatPrice(value);
  const loading = ordersQuery.isLoading;

  const handleCaptureAll = async () => {
    let done = 0;
    for (const order of uncosted) {
      try {
        await captureCosts.mutateAsync({ orderId: order.id });
        done += 1;
      } catch {
        // Keep going — one failure shouldn't abandon the rest of the batch.
      }
    }
    toast.success(
      done > 0
        ? `Captured costs on ${done} order${done === 1 ? '' : 's'}.`
        : 'No orders could be costed — check that your products have a recorded cost.'
    );
  };

  return (
    <div>
      <PageHeader
        title="Profitability"
        description="Net sales less cost of goods and operating expenses, using the weighted-average cost basis."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="profit"
              range={range}
              getRows={() => rows}
              columns={[
                { header: 'Name', value: (row) => row.label },
                { header: 'Units', value: (row) => row.units },
                { header: 'Revenue', value: (row) => row.revenue },
                { header: 'Cost', value: (row) => row.cost ?? '' },
                { header: 'Gross profit', value: (row) => row.grossProfit ?? '' },
                { header: 'Margin %', value: (row) => row.marginPercent ?? '' },
              ]}
            />
          </div>
        }
      />

      {pl.dataNote && <DataQualityNote message={pl.dataNote} className="mb-4" />}
      {pl.deliveryCostNote && <DataQualityNote message={pl.deliveryCostNote} className="mb-4" />}

      {uncosted.length > 0 && (
        <div className="border-border bg-card mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
            <div>
              <p className="text-foreground text-sm font-medium">
                {uncosted.length} order{uncosted.length === 1 ? '' : 's'} without a cost snapshot
              </p>
              <p className="text-muted-foreground text-xs text-pretty">
                Capturing costs records what each order’s goods cost, at today’s weighted average.
                It’s recorded once and never recalculated, so past margin stays accurate.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="brand"
            className="rounded-lg"
            onClick={handleCaptureAll}
            disabled={captureCosts.isPending}
          >
            {captureCosts.isPending ? 'Capturing…' : 'Capture costs'}
          </Button>
        </div>
      )}

      {/* The statement, in order */}
      <div className="border-border bg-card rounded-xl border p-5">
        <h2 className="text-foreground mb-4 text-sm font-semibold">Profit &amp; loss</h2>
        <dl className="divide-border divide-y">
          <StatementRow
            label="Net sales"
            hint="Gross sales − discounts − refunds"
            value={money(pl.sales.netSales)}
          />
          <StatementRow
            label="Less: cost of goods sold"
            hint={
              pl.cogs.coveragePercent === null
                ? 'Weighted average cost'
                : `${pl.cogs.coveragePercent}% of orders costed`
            }
            value={pl.dataQuality === 'unavailable' ? null : `− ${money(pl.cogs.total)}`}
            negative
          />
          <StatementRow
            label="Gross profit"
            hint={
              pl.grossMarginPercent === null
                ? 'Needs cost data'
                : `${pl.grossMarginPercent}% margin`
            }
            value={pl.grossProfit === null ? null : money(pl.grossProfit)}
            emphasis
          />
          <StatementRow
            label="Less: operating expenses"
            hint={
              pl.expenses.inventoryProcurement > 0
                ? `Excludes ${money(pl.expenses.inventoryProcurement)} of stock purchases`
                : 'Excludes inventory purchases'
            }
            value={`− ${money(pl.expenses.operating)}`}
            negative
          />
          <StatementRow
            label="Less: delivery costs"
            hint="Courier charges recorded on this period's orders"
            value={`− ${money(pl.deliveryCosts)}`}
            negative
          />
          <StatementRow
            label="Operating profit"
            hint={
              pl.operatingMarginPercent === null
                ? 'Needs cost data'
                : `${pl.operatingMarginPercent}% of net sales`
            }
            value={pl.operatingProfit === null ? null : money(pl.operatingProfit)}
            emphasis
          />
        </dl>
      </div>

      {/* Trend tiles */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Gross profit"
          value={pl.grossProfit === null ? null : money(pl.grossProfit)}
          unavailableReason={pl.grossProfit === null ? 'Insufficient cost data.' : undefined}
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
            pl.grossMarginPercent === null ? 'Needs sales and cost data.' : undefined
          }
          icon={Percent}
          caption="Gross profit ÷ net sales"
          loading={loading}
        />
        <MetricCard
          label="Cost of goods"
          value={pl.dataQuality === 'unavailable' ? null : money(pl.cogs.total)}
          unavailableReason={
            pl.dataQuality === 'unavailable' ? 'No cost basis recorded yet.' : undefined
          }
          icon={Coins}
          caption="Weighted average cost"
          polarity="lower_is_better"
          loading={loading}
        />
        <MetricCard
          label="Operating profit"
          value={pl.operatingProfit === null ? null : money(pl.operatingProfit)}
          unavailableReason={pl.operatingProfit === null ? 'Insufficient cost data.' : undefined}
          icon={Wallet}
          caption="After operating expenses"
          comparison={
            pl.operatingProfit !== null && priorPl.operatingProfit !== null
              ? compare(pl.operatingProfit, priorPl.operatingProfit, hasPrior)
              : undefined
          }
          formatChange={money}
          loading={loading}
        />
      </div>

      {/* Profit by dimension */}
      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Profit by</h2>
          <div className="flex gap-1" role="group" aria-label="Group profit by">
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
              icon={Receipt}
              title="No sales in this period"
              description="Profit is calculated from orders, so it appears once you have sales with recorded costs."
            />
          }
          columns={[
            {
              key: 'label',
              header: 'Name',
              cell: (row) => <span className="truncate">{row.label}</span>,
            },
            {
              key: 'units',
              header: 'Units',
              align: 'right',
              hideOnMobile: true,
              cell: (row) => row.units,
            },
            {
              key: 'revenue',
              header: 'Revenue',
              align: 'right',
              cell: (row) => money(row.revenue),
            },
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
              cell: (row) => (row.marginPercent === null ? null : `${row.marginPercent}%`),
            },
          ]}
        />
      </div>

      <p className="text-muted-foreground mt-4 text-xs text-pretty">
        Delivery costs are the courier charges recorded on each order. Operating expenses come from{' '}
        <Link href="/admin/expenses" className="text-brand hover:underline">
          Expenses
        </Link>
        . Stock purchases are excluded there and counted here as cost of goods when the stock sells.
      </p>
    </div>
  );
}

/** One labelled line of the P&L. `null` renders the insufficient-data state. */
function StatementRow({
  label,
  hint,
  value,
  emphasis,
  negative,
}: {
  label: string;
  hint?: string;
  value: string | null;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt
          className={emphasis ? 'text-foreground text-sm font-semibold' : 'text-foreground text-sm'}
        >
          {label}
        </dt>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </div>
      <dd
        className={`shrink-0 tabular-nums ${
          emphasis ? 'text-foreground text-base font-semibold' : 'text-foreground text-sm'
        } ${negative ? 'text-muted-foreground' : ''}`}
      >
        {value ?? <span className="text-muted-foreground text-sm">Not enough data</span>}
      </dd>
    </div>
  );
}
