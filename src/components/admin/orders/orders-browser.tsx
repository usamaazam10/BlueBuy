'use client';

import * as React from 'react';
import { AlertCircle, Loader2, Package, Search, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type Column, type SortState } from '@/components/admin/ui/data-table';
import { Input, Select } from '@/components/admin/ui/control';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Pagination } from '@/components/admin/ui/pagination';
import { useToast } from '@/components/ui/toast';
import { useOrdersQuery, useFulfilOrderStatus } from '@/hooks/queries';
import { ExportButton } from '@/components/admin/business/export-button';
import { formatDate } from '@/lib/business';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/types/order';
import { orderStatusLabel } from '@/lib/order/status';
import { toAppError } from '@/firebase';
import { useCurrency } from '@/hooks/use-currency';
import type { FirestoreDate } from '@/types/models';
import { OrderStatusBadge } from './order-status-badge';
import { OrderDetail } from './order-detail';

const PAGE_SIZE = 10;

/**
 * Convert a Firestore timestamp field to epoch millis for sorting.
 *
 * Handles every shape the value can arrive in: a `Date`, a live Firestore
 * `Timestamp` (`.toMillis()`), or a plain `{ seconds, nanoseconds }` object —
 * which is what a `Timestamp` degrades to after React Query's structural
 * sharing deep-clones the cached data and drops its prototype.
 */
function toMillis(date: FirestoreDate): number {
  if (!date) return 0;
  if (date instanceof Date) return date.getTime();
  if (typeof (date as { toMillis?: () => number }).toMillis === 'function') {
    return (date as { toMillis: () => number }).toMillis();
  }
  const seconds = (date as { seconds?: number })?.seconds;
  return typeof seconds === 'number' ? seconds * 1000 : 0;
}

/** Short, sortable date label for the table (e.g. "Jul 24, 2026"). */
function toDateLabel(date: FirestoreDate): string {
  const ms = toMillis(date);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Total units across an order's lines. */
function unitCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

const SORT_PRESETS: Record<string, SortState> = {
  newest: { key: 'createdAt', dir: 'desc' },
  oldest: { key: 'createdAt', dir: 'asc' },
  'total-desc': { key: 'total', dir: 'desc' },
  'total-asc': { key: 'total', dir: 'asc' },
};

/** Extract a comparable value for a given sort key. */
function sortValue(order: Order, key: string): string | number {
  switch (key) {
    case 'total':
      return order.total;
    case 'customer':
      return order.customer.fullName.toLowerCase();
    case 'status':
      return order.status;
    default:
      return toMillis(order.createdAt);
  }
}

/**
 * Admin orders browser: a searchable, status-filterable, date-sortable table of
 * orders backed by React Query. Clicking a row opens the {@link OrderDetail}
 * slide-over, where the fulfilment status can be advanced. All data access goes
 * through the order hooks — never Firestore directly.
 */
export function OrdersBrowser() {
  const toast = useToast();
  const { data: orders, isLoading, isError, error, refetch } = useOrdersQuery();
  const updateStatus = useFulfilOrderStatus();
  const { formatPrice } = useCurrency();

  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<'all' | OrderStatus>('all');
  const [sort, setSort] = React.useState<SortState>({ key: 'createdAt', dir: 'desc' });
  const [page, setPage] = React.useState(1);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Reset to the first page whenever the result set changes.
  React.useEffect(() => {
    setPage(1);
  }, [search, status, sort]);

  const list = React.useMemo(() => orders ?? [], [orders]);

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = list.filter((order) => {
      if (status !== 'all' && order.status !== status) return false;
      if (query) {
        const haystack =
          `${order.orderId} ${order.customer.fullName} ${order.customer.phone}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
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
  }, [list, search, status, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Keep the detail panel bound to live query data so it reflects status updates.
  const selectedOrder = React.useMemo(
    () => (selectedId ? (list.find((o) => o.id === selectedId) ?? null) : null),
    [list, selectedId]
  );

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
    );

  const hasFilters = search !== '' || status !== 'all';
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
  };

  function handleUpdateStatus(order: Order, next: OrderStatus, restock = true) {
    // Goes through the fulfilment service rather than a bare status write:
    // cancelling or returning an order must also decide what happens to its
    // stock (checkout removed the units at placement) and record the inventory
    // movements and audit entry — all in one transaction. It is idempotent, so
    // a repeated cancel can't inflate stock. See BUSINESS_OPERATIONS.md
    // § Inventory ledger.
    updateStatus.mutate(
      { id: order.id, status: next, restock },
      {
        onSuccess: () => {
          const closed = next === 'cancelled' || next === 'returned';
          toast.success(
            'Status updated',
            `${order.orderId} is now ${orderStatusLabel(next)}.${
              closed
                ? restock
                  ? ' Its items were returned to stock.'
                  : ' Its items were written off, not returned to stock.'
                : ''
            }`
          );
        },
        onError: (err) => toast.error('Update failed', toAppError(err).message),
      }
    );
  }

  const columns: Column<Order>[] = [
    {
      key: 'orderId',
      header: 'Order',
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-foreground font-mono text-[13px] font-medium">{o.orderId}</p>
          <p className="text-muted-foreground truncate text-xs">
            {o.items.length} {o.items.length === 1 ? 'item' : 'items'} · {unitCount(o)} units
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      sortable: true,
      cell: (o) => (
        <div className="min-w-0">
          <p className="text-foreground truncate">{o.customer.fullName}</p>
          <p className="text-muted-foreground truncate text-xs">{o.customer.phone}</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      hideOnMobile: true,
      cell: (o) => <span className="text-muted-foreground">{toDateLabel(o.createdAt)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      align: 'right',
      cell: (o) => (
        <span className="text-foreground font-medium tabular-nums">
          {formatPrice(o.total, o.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
  ];

  if (isLoading) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading orders…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Couldn’t load orders"
        description={toAppError(error).message}
        action={
          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => refetch()}>
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
            placeholder="Search by order #, name or phone…"
            aria-label="Search orders"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | OrderStatus)}
            aria-label="Filter by status"
            className="sm:w-40"
          >
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {orderStatusLabel(s)}
              </option>
            ))}
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
            aria-label="Sort orders"
            className="sm:w-40"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total-desc">Total: High to Low</option>
            <option value="total-asc">Total: Low to High</option>
          </Select>
        </div>

        {/* Exports exactly what the current filters and sort produced, not the
            whole collection — what you see is what you get. */}
        <ExportButton
          kind="orders"
          getRows={() => filtered}
          columns={[
            { header: 'Order', value: (o) => o.orderId },
            { header: 'Placed', value: (o) => formatDate(o.createdAt) },
            { header: 'Status', value: (o) => orderStatusLabel(o.status) },
            { header: 'Customer', value: (o) => o.customer.fullName },
            { header: 'City', value: (o) => o.customer.city },
            { header: 'Items', value: (o) => o.items.length },
            { header: 'Units', value: (o) => o.items.reduce((n, i) => n + i.quantity, 0) },
            { header: 'Subtotal', value: (o) => o.subtotal },
            { header: 'Discount', value: (o) => o.discount },
            { header: 'Shipping', value: (o) => o.shipping },
            { header: 'Total', value: (o) => o.total },
            { header: 'Refunded', value: (o) => o.refundedAmount ?? '' },
            { header: 'Currency', value: (o) => o.currency },
            { header: 'Courier', value: (o) => o.delivery?.courier ?? '' },
            { header: 'Tracking', value: (o) => o.delivery?.trackingNumber ?? '' },
          ]}
        />
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
        rowKey={(o) => o.id}
        sort={sort}
        onSortChange={toggleSort}
        onRowClick={(o) => setSelectedId(o.id)}
        empty={
          <EmptyState
            icon={hasFilters ? Package : ShoppingCart}
            title={hasFilters ? 'No orders found' : 'No orders yet'}
            description={
              hasFilters
                ? 'No orders match your filters. Try adjusting or clearing them.'
                : 'Orders placed at checkout will appear here.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" className="rounded-lg" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
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

      <OrderDetail
        order={selectedOrder}
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        onUpdateStatus={handleUpdateStatus}
        updating={updateStatus.isPending}
      />
    </div>
  );
}
