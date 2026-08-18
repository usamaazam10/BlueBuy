'use client';

/**
 * Customer analytics, inferred from guest orders.
 *
 * BlueBuy has no customer accounts, so every figure here is derived by matching
 * orders on contact details. That inference is stated on the page rather than
 * buried in a doc — an owner reading "42 customers" deserves to know it means
 * "42 distinct phone numbers", not 42 registered people.
 *
 * Contact details are not displayed. A row shows a name, a city and the last
 * four digits of a phone — enough to recognise a regular, without turning the
 * dashboard into an exportable contact list.
 */
import * as React from 'react';
import { Repeat, ShoppingBag, UserPlus, Users } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { useCurrency } from '@/hooks/use-currency';
import { useOrdersQuery } from '@/hooks/queries';
import {
  customerRows,
  customerStats,
  formatDate,
  ordersInRange,
  type CustomerRow,
} from '@/lib/business';
import { MetricCard, DataQualityNote } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';

type Ranking = 'revenue' | 'orders';

export function CustomersBrowser() {
  const { formatPrice } = useCurrency();
  const dates = useDateRange('last_30_days');
  const ordersQuery = useOrdersQuery();

  const [ranking, setRanking] = React.useState<Ranking>('revenue');

  const orders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const inPeriod = React.useMemo(() => ordersInRange(orders, dates.range), [orders, dates.range]);

  const stats = React.useMemo(() => customerStats(orders, dates.range), [orders, dates.range]);
  const rows = React.useMemo(() => customerRows(inPeriod), [inPeriod]);

  const ranked = React.useMemo(
    () =>
      ranking === 'orders'
        ? [...rows].sort((a, b) => b.orders - a.orders || b.revenue - a.revenue)
        : rows,
    [rows, ranking]
  );

  const loading = ordersQuery.isLoading;

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Who buys from BlueBuy, how often, and what they're worth."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="customers"
              range={dates.range}
              getRows={() => ranked}
              columns={[
                { header: 'Customer', value: (row) => row.name },
                { header: 'City', value: (row) => row.city },
                { header: 'Phone (masked)', value: (row) => row.maskedPhone },
                { header: 'Orders', value: (row) => row.orders },
                { header: 'Units', value: (row) => row.units },
                { header: 'Revenue', value: (row) => row.revenue },
                { header: 'Average order value', value: (row) => row.averageOrderValue ?? '' },
                {
                  header: 'First order',
                  value: (row) => (row.firstOrderAt ? formatDate(new Date(row.firstOrderAt)) : ''),
                },
                {
                  header: 'Last order',
                  value: (row) => (row.lastOrderAt ? formatDate(new Date(row.lastOrderAt)) : ''),
                },
                { header: 'Returning', value: (row) => (row.returning ? 'Yes' : 'No') },
              ]}
            />
          </div>
        }
      />

      <DataQualityNote
        className="mb-4"
        tone="info"
        message="BlueBuy uses guest checkout, so customers are inferred by matching orders on phone number. Two people sharing a number count as one customer, and one person using two numbers counts as two."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Customers"
          value={String(stats.totalCustomers)}
          icon={Users}
          caption="Ordered in this period"
          polarity="neutral"
          loading={loading}
        />
        <MetricCard
          label="New customers"
          value={String(stats.newCustomers)}
          icon={UserPlus}
          caption="First ever order in this period"
          loading={loading}
        />
        <MetricCard
          label="Returning customers"
          value={String(stats.returningCustomers)}
          icon={Repeat}
          caption="Had ordered before this period"
          loading={loading}
        />
        <MetricCard
          label="Revenue per customer"
          value={stats.revenuePerCustomer === null ? null : formatPrice(stats.revenuePerCustomer)}
          unavailableReason={
            stats.revenuePerCustomer === null ? 'No customers in this period.' : undefined
          }
          icon={ShoppingBag}
          caption="In this period — not a lifetime projection"
          loading={loading}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Repeat rate"
          value={stats.repeatRate === null ? null : `${stats.repeatRate}%`}
          unavailableReason={stats.repeatRate === null ? 'No customer history yet.' : undefined}
          icon={Repeat}
          caption="Customers who ever ordered more than once"
          loading={loading}
        />
        <MetricCard
          label="Orders per customer"
          value={
            stats.averageOrdersPerCustomer === null ? null : String(stats.averageOrdersPerCustomer)
          }
          unavailableReason={
            stats.averageOrdersPerCustomer === null ? 'No customers in this period.' : undefined
          }
          icon={ShoppingBag}
          caption="In this period"
          polarity="neutral"
          loading={loading}
        />
        <MetricCard
          label="Average order value"
          value={stats.averageOrderValue === null ? null : formatPrice(stats.averageOrderValue)}
          unavailableReason={
            stats.averageOrderValue === null ? 'No orders in this period.' : undefined
          }
          icon={ShoppingBag}
          caption="Across this period's orders"
          loading={loading}
        />
      </div>

      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Top customers</h2>
          <div className="flex gap-1" role="group" aria-label="Rank customers by">
            {(['revenue', 'orders'] as Ranking[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRanking(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  ranking === option
                    ? 'bg-brand text-brand-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                aria-pressed={ranking === option}
              >
                By {option}
              </button>
            ))}
          </div>
        </div>

        <BreakdownTable
          rows={ranked}
          rowKey={(row) => row.key}
          initialRows={20}
          empty={
            <EmptyState
              icon={Users}
              title="No customers in this period"
              description="Orders placed on the storefront will build this list."
            />
          }
          columns={[
            {
              key: 'name',
              header: 'Customer',
              cell: (row: CustomerRow) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.city} · {row.maskedPhone}
                  </p>
                </div>
              ),
            },
            { key: 'orders', header: 'Orders', align: 'right', cell: (row) => row.orders },
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
              cell: (row) => formatPrice(row.revenue),
            },
            {
              key: 'aov',
              header: 'Avg order',
              align: 'right',
              hideOnMobile: true,
              cell: (row) =>
                row.averageOrderValue === null ? null : formatPrice(row.averageOrderValue),
            },
            {
              key: 'last',
              header: 'Last order',
              align: 'right',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {row.lastOrderAt ? formatDate(new Date(row.lastOrderAt)) : '—'}
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
