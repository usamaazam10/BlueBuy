'use client';

/**
 * Website analytics — traffic, the conversion funnel, and search.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * This screen distinguishes three states that look identical if you're careless,
 * and would each mislead the owner differently:
 *
 *   never tracked  — the tracker has never recorded anything. "No data yet",
 *                    with an explanation. NOT "zero visitors".
 *   empty period   — tracking works, but this window had no activity. A real,
 *                    meaningful zero.
 *   thin data      — some traffic, but too little to state conversion rates.
 *                    Counts are shown; rates are withheld.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import * as React from 'react';
import {
  Activity,
  Eye,
  MousePointerClick,
  RefreshCw,
  Search,
  TrendingDown,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth, can } from '@/lib/auth';
import {
  useAnalyticsWindow,
  useRebuildAnalyticsSummaries,
  useCategoriesQuery,
} from '@/hooks/queries';
import {
  addToCartRate,
  conversionFunnel,
  formatDayLabel,
  orderConversionRate,
  searchTerms,
  topViewedCategories,
  topViewedProducts,
  trafficSeries,
  trafficSummary,
  zeroResultSearches,
} from '@/lib/business';
import { MetricCard, DataQualityNote } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';
import { LineChart, RankBars } from './charts';

export function AnalyticsBrowser() {
  const { user } = useAuth();
  const canRebuild = can(user?.role ?? 'viewer', 'settings.manage');

  const toast = useToast();
  const dates = useDateRange('last_30_days');
  const windowQuery = useAnalyticsWindow(dates.range);
  const categoriesQuery = useCategoriesQuery();
  const rebuild = useRebuildAnalyticsSummaries();

  const events = React.useMemo(() => windowQuery.data?.events ?? [], [windowQuery.data]);
  const neverTracked = windowQuery.data?.neverTracked ?? false;
  const truncated = windowQuery.data?.truncated ?? false;

  const categoryNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categoriesQuery.data ?? []) map.set(category.id, category.name);
    return map;
  }, [categoriesQuery.data]);

  const traffic = React.useMemo(() => trafficSummary(events), [events]);
  const series = React.useMemo(() => trafficSeries(events, dates.range), [events, dates.range]);
  const funnel = React.useMemo(() => conversionFunnel(events), [events]);
  const topProducts = React.useMemo(() => topViewedProducts(events), [events]);
  const topCategories = React.useMemo(
    () => topViewedCategories(events, categoryNames),
    [events, categoryNames]
  );
  const terms = React.useMemo(() => searchTerms(events), [events]);
  const unmet = React.useMemo(() => zeroResultSearches(events), [events]);

  const conversion = React.useMemo(() => orderConversionRate(events), [events]);
  const cartRate = React.useMemo(() => addToCartRate(events), [events]);

  // Nothing has ever been tracked — say that, rather than reporting zeros that
  // would read as "nobody visits your store".
  if (!windowQuery.isLoading && neverTracked) {
    return (
      <div>
        <PageHeader
          title="Website analytics"
          description="Traffic, conversion and search behaviour on your storefront."
        />
        <div className="border-border bg-card rounded-xl border">
          <EmptyState
            icon={Activity}
            title="No analytics data yet"
            description="Event tracking is live on the storefront, but nothing has been recorded so far. Visits, product views, searches and cart activity will appear here as customers browse — usually within a few minutes of the next visit."
          />
        </div>
        <p className="text-muted-foreground mt-4 text-xs text-pretty">
          Your own visits to <code>/admin</code> are deliberately excluded, so browsing the
          dashboard will not create data here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Website analytics"
        description="Traffic, conversion and search behaviour — measured on your storefront."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            {canRebuild && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={rebuild.isPending}
                onClick={() =>
                  rebuild.mutate(dates.range, {
                    onSuccess: (result) =>
                      toast.success(
                        `Rebuilt ${result.days} daily summar${result.days === 1 ? 'y' : 'ies'} from ${result.events} events.`
                      ),
                    onError: (error) => toast.error(error.message),
                  })
                }
              >
                <RefreshCw className={rebuild.isPending ? 'size-4 animate-spin' : 'size-4'} />
                Rebuild summaries
              </Button>
            )}
          </div>
        }
      />

      {truncated && (
        <DataQualityNote
          className="mb-4"
          message="This period contains more events than a single read returns, so the figures below cover only the most recent portion of it. Choose a shorter period for exact numbers."
        />
      )}

      {/* Traffic */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Sessions"
          value={String(traffic.sessions)}
          icon={Users}
          caption="Distinct browsing sessions"
          polarity="neutral"
          loading={windowQuery.isLoading}
        />
        <MetricCard
          label="Page views"
          value={String(traffic.pageViews)}
          icon={Eye}
          caption="Storefront pages opened"
          polarity="neutral"
          loading={windowQuery.isLoading}
        />
        <MetricCard
          label="Add-to-cart rate"
          value={cartRate === null ? null : `${cartRate}%`}
          unavailableReason={
            cartRate === null ? 'Not enough product views yet to state a rate.' : undefined
          }
          icon={MousePointerClick}
          caption="Sessions that added, of those that viewed a product"
          loading={windowQuery.isLoading}
        />
        <MetricCard
          label="Order conversion"
          value={conversion === null ? null : `${conversion}%`}
          unavailableReason={
            conversion === null ? 'Not enough visits yet to state a rate.' : undefined
          }
          icon={TrendingDown}
          caption="Sessions that ordered, of all sessions"
          loading={windowQuery.isLoading}
        />
      </div>

      <div className="border-border bg-card mt-6 rounded-xl border p-5">
        <h2 className="text-foreground mb-2 text-sm font-semibold">Traffic over time</h2>
        <LineChart
          labels={series.map((point) => formatDayLabel(point.dayKey))}
          series={[
            { label: 'Sessions', values: series.map((point) => point.sessions), slot: 1 },
            { label: 'Product views', values: series.map((point) => point.productViews), slot: 2 },
          ]}
          format={(value) => String(Math.round(value))}
          ariaLabel={`Sessions and product views per day, ${dates.range.label}`}
          emptyMessage="No traffic recorded in this period."
        />
      </div>

      {/* Funnel */}
      <div className="border-border bg-card mt-6 rounded-xl border p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-foreground text-sm font-semibold">Conversion funnel</h2>
          {funnel.hasEnoughData && funnel.biggestDropOff && (
            <p className="text-muted-foreground text-xs">
              Biggest drop-off at{' '}
              <span className="text-foreground font-medium">{funnel.biggestDropOff.label}</span>
            </p>
          )}
        </div>

        {funnel.note && <DataQualityNote message={funnel.note} tone="info" className="mb-4" />}

        <ol className="space-y-3">
          {funnel.stages.map((stage, index) => {
            const widest = funnel.stages[0]?.sessions || 1;
            const width = Math.max(2, (stage.sessions / widest) * 100);
            const isWorst = funnel.biggestDropOff?.key === stage.key;

            return (
              <li key={stage.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-foreground text-sm">
                    {index + 1}. {stage.label}
                  </span>
                  <span className="text-foreground shrink-0 text-sm font-medium tabular-nums">
                    {stage.sessions}
                    {stage.conversionFromPrevious !== null && (
                      <span className="text-muted-foreground ml-2 font-normal">
                        {stage.conversionFromPrevious}% of previous
                      </span>
                    )}
                  </span>
                </div>
                <div className="bg-muted mt-1.5 h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      backgroundColor: isWorst ? 'var(--chart-2)' : 'var(--chart-1)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Views */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Most viewed products</h2>
          <RankBars
            rows={topProducts.map((row) => ({
              label: row.label,
              value: row.views,
              hint: `${row.sessions} session${row.sessions === 1 ? '' : 's'}`,
            }))}
            format={(value) => `${Math.round(value)} views`}
            emptyMessage="No product views in this period."
          />
        </div>

        <div className="border-border bg-card rounded-xl border p-5">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Most viewed categories</h2>
          <RankBars
            rows={topCategories.map((row) => ({
              label: row.label,
              value: row.views,
              hint: `${row.sessions} session${row.sessions === 1 ? '' : 's'}`,
            }))}
            format={(value) => `${Math.round(value)} views`}
            slot={3}
            emptyMessage="No category views in this period."
          />
        </div>
      </div>

      {/* Search */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="border-border bg-card rounded-xl border">
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">What customers search for</h2>
            <ExportButton
              kind="search-terms"
              range={dates.range}
              getRows={() => terms}
              columns={[
                { header: 'Term', value: (row) => row.term },
                { header: 'Searches', value: (row) => row.searches },
                { header: 'No-result searches', value: (row) => row.noResultSearches },
                { header: 'Last result count', value: (row) => row.lastResultCount ?? '' },
              ]}
              label="Export"
            />
          </div>
          <BreakdownTable
            rows={terms}
            rowKey={(row) => row.term}
            initialRows={10}
            empty={
              <EmptyState
                icon={Search}
                title="No searches in this period"
                description="Terms customers type into the storefront search will appear here."
              />
            }
            columns={[
              { key: 'term', header: 'Term', cell: (row) => row.term },
              { key: 'count', header: 'Searches', align: 'right', cell: (row) => row.searches },
              {
                key: 'results',
                header: 'Results',
                align: 'right',
                hideOnMobile: true,
                cell: (row) => (row.lastResultCount === null ? null : row.lastResultCount),
              },
            ]}
          />
        </div>

        <div className="border-border bg-card rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Searches that found nothing</h2>
            <p className="text-muted-foreground text-xs text-pretty">
              Demand your catalogue isn’t meeting — the clearest signal of what to stock next.
            </p>
          </div>
          <BreakdownTable
            rows={unmet}
            rowKey={(row) => row.term}
            initialRows={10}
            empty={
              <EmptyState
                icon={Search}
                title="Every search found something"
                description="No customer searched for a product you don't carry in this period."
              />
            }
            columns={[
              { key: 'term', header: 'Term', cell: (row) => row.term },
              {
                key: 'count',
                header: 'Empty searches',
                align: 'right',
                cell: (row) => row.noResultSearches,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
