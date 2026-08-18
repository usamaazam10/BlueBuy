'use client';

/**
 * Inventory dashboard — stock positions, valuation, adjustments and the ledger.
 *
 * The adjustment flow is the important part: an operator enters the quantity
 * they *counted*, with a reason, and the service derives the delta inside a
 * transaction. There is no path in this UI that sets a stock number without
 * writing a movement explaining it.
 */
import * as React from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Boxes,
  History,
  Layers,
  PackageX,
  RefreshCw,
  Coins,
} from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/admin/ui/control';
import { useToast } from '@/components/ui/toast';
import { useAuth, can } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import {
  useProductsQuery,
  useOrdersQuery,
  useInventoryMovementsQuery,
  useAdjustStock,
  useSetCostBasis,
  useReconcileSaleMovements,
} from '@/hooks/queries';
import {
  formatDateTime,
  inventoryPositions,
  inventorySummary,
  type InventoryPosition,
} from '@/lib/business';
import { MANUAL_MOVEMENT_TYPES, type InventoryMovementType } from '@/types/business';
import { LOW_STOCK_THRESHOLD } from '@/data/admin/products';
import { MetricCard, DataQualityNote } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';

/** Human labels for the movement types. */
const MOVEMENT_LABELS: Record<string, string> = {
  purchase_received: 'Purchase received',
  sale: 'Sale',
  return: 'Return',
  adjustment: 'Adjustment',
  damaged: 'Damaged',
  lost: 'Lost',
  transfer: 'Stock transfer',
  correction: 'Correction',
};

const STATE_STYLES: Record<InventoryPosition['state'], string> = {
  out_of_stock: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  low: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  overstock: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const STATE_LABELS: Record<InventoryPosition['state'], string> = {
  out_of_stock: 'Out of stock',
  low: 'Low',
  healthy: 'Healthy',
  overstock: 'Overstock',
};

export function InventoryBrowser() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const canAdjust = can(role, 'inventory.adjust');
  const showCost = can(role, 'finance.view');

  const { formatPrice } = useCurrency();
  const toast = useToast();
  const dates = useDateRange('last_30_days');

  const productsQuery = useProductsQuery();
  const ordersQuery = useOrdersQuery();
  const movementsQuery = useInventoryMovementsQuery(dates.range);
  const reconcile = useReconcileSaleMovements();

  const [adjusting, setAdjusting] = React.useState<InventoryPosition | null>(null);
  const [costing, setCosting] = React.useState<InventoryPosition | null>(null);
  const [filter, setFilter] = React.useState<'all' | InventoryPosition['state']>('all');

  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);
  const orders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const movements = React.useMemo(() => movementsQuery.data ?? [], [movementsQuery.data]);

  const positions = React.useMemo(
    () => inventoryPositions(products, orders, { lowStockThreshold: LOW_STOCK_THRESHOLD }),
    [products, orders]
  );
  const summary = React.useMemo(() => inventorySummary(positions), [positions]);

  const visible = React.useMemo(() => {
    const rows = filter === 'all' ? positions : positions.filter((p) => p.state === filter);
    // Most urgent first: empty shelves, then low, then the rest by value.
    const priority: Record<InventoryPosition['state'], number> = {
      out_of_stock: 0,
      low: 1,
      overstock: 2,
      healthy: 3,
    };
    return [...rows].sort(
      (a, b) => priority[a.state] - priority[b.state] || (b.value ?? 0) - (a.value ?? 0)
    );
  }, [positions, filter]);

  const unreconciled = React.useMemo(
    () => orders.filter((order) => !order.saleMovementsRecorded && order.status !== 'cancelled'),
    [orders]
  );

  const handleReconcile = () => {
    reconcile.mutate(unreconciled, {
      onSuccess: (result) => {
        toast.success(
          result.movementsAdded > 0
            ? `Added ${result.movementsAdded} ledger entries across ${result.ordersReconciled} orders.`
            : 'The ledger was already up to date.'
        );
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Stock levels, valuation and every movement that changed them."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton
              kind="inventory"
              getRows={() => visible}
              columns={[
                { header: 'Product', value: (row) => row.title },
                { header: 'Available', value: (row) => row.available },
                { header: 'Reserved', value: (row) => row.reserved },
                { header: 'On hand', value: (row) => row.onHand },
                { header: 'State', value: (row) => STATE_LABELS[row.state] },
                ...(showCost
                  ? [
                      {
                        header: 'Unit cost',
                        value: (row: InventoryPosition) => row.unitCost ?? '',
                      },
                      { header: 'Stock value', value: (row: InventoryPosition) => row.value ?? '' },
                    ]
                  : []),
              ]}
            />
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Units in stock"
          value={String(summary.totalUnits)}
          icon={Boxes}
          caption={`${summary.reservedUnits} committed to open orders`}
          polarity="neutral"
          loading={productsQuery.isLoading}
        />
        {showCost && (
          <MetricCard
            label="Inventory value"
            value={formatPrice(summary.totalValue)}
            icon={Layers}
            caption={
              summary.valuationComplete
                ? 'At weighted average cost'
                : `${summary.unvaluedProducts} product${summary.unvaluedProducts === 1 ? '' : 's'} without a cost`
            }
            polarity="neutral"
            loading={productsQuery.isLoading}
          />
        )}
        <MetricCard
          label="Low stock"
          value={String(summary.lowStockCount)}
          icon={AlertTriangle}
          caption={`${LOW_STOCK_THRESHOLD} or fewer available`}
          polarity="lower_is_better"
          loading={productsQuery.isLoading}
        />
        <MetricCard
          label="Out of stock"
          value={String(summary.outOfStockCount)}
          icon={PackageX}
          caption="Needs restocking"
          polarity="lower_is_better"
          loading={productsQuery.isLoading}
        />
      </div>

      {showCost && !summary.valuationComplete && (
        <DataQualityNote
          className="mt-4"
          message={`${summary.unvaluedProducts} product${summary.unvaluedProducts === 1 ? ' has' : 's have'} stock but no recorded cost, so they are excluded from the inventory value above. Receive them on a purchase order, or set a unit cost, to include them.`}
        />
      )}

      {unreconciled.length > 0 && canAdjust && (
        <div className="border-border bg-card mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div>
            <p className="text-foreground text-sm font-medium">
              {unreconciled.length} order{unreconciled.length === 1 ? '' : 's'} not in the stock
              ledger
            </p>
            <p className="text-muted-foreground text-xs text-pretty">
              Checkout reduces stock from the public storefront, which can’t write to the ledger.
              Post the matching sale entries so movement history reconciles.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            onClick={handleReconcile}
            disabled={reconcile.isPending}
          >
            <RefreshCw className={reconcile.isPending ? 'size-4 animate-spin' : 'size-4'} />
            {reconcile.isPending ? 'Posting…' : 'Post sale entries'}
          </Button>
        </div>
      )}

      {/* Positions */}
      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Stock by product</h2>
          <Select
            aria-label="Filter by stock state"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            className="w-auto min-w-36"
            compact
          >
            <option value="all">All products</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="low">Low stock</option>
            <option value="healthy">Healthy</option>
            <option value="overstock">Overstock</option>
          </Select>
        </div>

        <BreakdownTable
          rows={visible}
          rowKey={(row) => row.productId}
          initialRows={15}
          empty={
            <EmptyState
              icon={Boxes}
              title={filter === 'all' ? 'No products yet' : 'Nothing in this state'}
              description={
                filter === 'all'
                  ? 'Add products to your catalogue to start tracking stock.'
                  : 'Try a different filter.'
              }
            />
          }
          columns={[
            {
              key: 'product',
              header: 'Product',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{row.slug}</p>
                </div>
              ),
            },
            {
              key: 'state',
              header: 'State',
              cell: (row) => (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATE_STYLES[row.state]}`}
                >
                  {STATE_LABELS[row.state]}
                </span>
              ),
            },
            { key: 'available', header: 'Available', align: 'right', cell: (row) => row.available },
            {
              key: 'reserved',
              header: 'Reserved',
              align: 'right',
              hideOnMobile: true,
              cell: (row) => row.reserved,
            },
            ...(showCost
              ? [
                  {
                    key: 'cost',
                    header: 'Unit cost',
                    align: 'right' as const,
                    hideOnMobile: true,
                    cell: (row: InventoryPosition) =>
                      row.unitCost === null ? null : formatPrice(row.unitCost),
                  },
                  {
                    key: 'value',
                    header: 'Stock value',
                    align: 'right' as const,
                    cell: (row: InventoryPosition) =>
                      row.value === null ? null : formatPrice(row.value),
                  },
                ]
              : []),
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (row) =>
                canAdjust ? (
                  <div className="flex justify-end gap-1">
                    {showCost && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg"
                        onClick={() => setCosting(row)}
                      >
                        <Coins className="size-3.5" />
                        <span className="sr-only">Set cost for {row.title}</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => setAdjusting(row)}
                    >
                      <ArrowLeftRight className="size-3.5" />
                      Adjust
                    </Button>
                  </div>
                ) : null,
            },
          ]}
        />
      </div>

      {/* Ledger */}
      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Movement history</h2>
            <p className="text-muted-foreground text-xs">
              Every change to stock, and what caused it.
            </p>
          </div>
          <DateRangePicker state={dates} />
        </div>

        <BreakdownTable
          rows={movements}
          rowKey={(row) => row.id}
          initialRows={20}
          empty={
            <EmptyState
              icon={History}
              title="No stock movements in this period"
              description="Receiving a purchase order or adjusting stock will record entries here."
            />
          }
          columns={[
            {
              key: 'when',
              header: 'When',
              cell: (row) => (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDateTime(row.occurredAt)}
                </span>
              ),
            },
            {
              key: 'product',
              header: 'Product',
              cell: (row) => <span className="truncate">{row.productTitle}</span>,
            },
            {
              key: 'type',
              header: 'Type',
              cell: (row) => MOVEMENT_LABELS[row.type] ?? row.type,
            },
            {
              key: 'change',
              header: 'Change',
              align: 'right',
              cell: (row) => (
                <span
                  className={
                    row.quantityChange > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }
                >
                  {row.quantityChange > 0 ? '+' : ''}
                  {row.quantityChange}
                </span>
              ),
            },
            {
              key: 'after',
              header: 'Stock after',
              align: 'right',
              hideOnMobile: true,
              cell: (row) => row.stockAfter,
            },
            {
              key: 'reason',
              header: 'Reason',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs">
                  {row.reason || row.reference.label || '—'}
                </span>
              ),
            },
            {
              key: 'who',
              header: 'By',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs">{row.createdBy.label}</span>
              ),
            },
          ]}
        />
      </div>

      {adjusting && <AdjustStockModal position={adjusting} onClose={() => setAdjusting(null)} />}
      {costing && <SetCostModal position={costing} onClose={() => setCosting(null)} />}
    </div>
  );
}

/** The manual stock adjustment dialog. A reason is mandatory. */
function AdjustStockModal({
  position,
  onClose,
}: {
  position: InventoryPosition;
  onClose: () => void;
}) {
  const toast = useToast();
  const adjust = useAdjustStock();

  const [newQuantity, setNewQuantity] = React.useState(String(position.available));
  const [type, setType] = React.useState<InventoryMovementType>('adjustment');
  const [reason, setReason] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const parsed = Number.parseInt(newQuantity, 10);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed !== position.available;
  const delta = Number.isInteger(parsed) ? parsed - position.available : 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || !reason.trim()) return;

    adjust.mutate(
      {
        productId: position.productId,
        currentQuantity: position.available,
        newQuantity: parsed,
        type,
        reason: reason.trim(),
        notes: notes.trim(),
      },
      {
        onSuccess: (result) => {
          toast.success(
            `${result.productTitle}: ${result.previousStock} → ${result.newStock} units.`
          );
          onClose();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Modal open onClose={onClose} title={`Adjust stock — ${position.title}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Current quantity">
            <Input value={position.available} readOnly disabled />
          </Field>
          <Field label="Counted quantity" required>
            <Input
              type="number"
              min={0}
              value={newQuantity}
              onChange={(event) => setNewQuantity(event.target.value)}
              autoFocus
            />
          </Field>
        </div>

        {delta !== 0 && (
          <p className="text-muted-foreground text-sm">
            This records a movement of{' '}
            <span
              className={
                delta > 0
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'font-medium text-rose-600 dark:text-rose-400'
              }
            >
              {delta > 0 ? '+' : ''}
              {delta}
            </span>{' '}
            units.
          </p>
        )}

        <Field label="Reason type" required>
          <Select
            value={type}
            onChange={(event) => setType(event.target.value as InventoryMovementType)}
          >
            {MANUAL_MOVEMENT_TYPES.map((option) => (
              <option key={option} value={option}>
                {MOVEMENT_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Reason" required hint="Recorded in the audit trail.">
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Stock count correction"
            maxLength={200}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional detail"
            maxLength={2000}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={!valid || !reason.trim() || adjust.isPending}
          >
            {adjust.isPending ? 'Saving…' : 'Record adjustment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Opens a manual cost basis for stock bought before purchase tracking existed. */
function SetCostModal({ position, onClose }: { position: InventoryPosition; onClose: () => void }) {
  const toast = useToast();
  const setCost = useSetCostBasis();
  const [value, setValue] = React.useState(
    position.unitCost === null ? '' : String(position.unitCost)
  );

  const parsed = value.trim() === '' ? null : Number.parseFloat(value);
  const valid = parsed === null || (Number.isFinite(parsed) && parsed >= 0);

  return (
    <Modal open onClose={onClose} title={`Unit cost — ${position.title}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          setCost.mutate(
            { productId: position.productId, costPrice: parsed },
            {
              onSuccess: () => {
                toast.success('Cost updated.');
                onClose();
              },
              onError: (error) => toast.error(error.message),
            }
          );
        }}
        className="space-y-4"
      >
        <p className="text-muted-foreground text-sm text-pretty">
          Use this for stock you bought before recording purchases in BlueBuy. Once the product is
          received on a purchase order, its weighted average cost takes over and this value is no
          longer used.
        </p>

        <Field label="Unit cost" hint="Leave empty to clear the cost (reported as unknown).">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={!valid || setCost.isPending}
          >
            {setCost.isPending ? 'Saving…' : 'Save cost'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
