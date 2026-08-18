'use client';

/**
 * Purchase orders — raising them, and receiving goods against them.
 *
 * The receiving dialog is the only place in the app that raises stock. It
 * defaults each line to the quantity still outstanding and to the cost the goods
 * were ordered at, but both are editable: suppliers short-ship and invoice at a
 * different price, and the *actual* received cost is what must feed the weighted
 * average — not what was hoped for when the order was raised.
 */
import * as React from 'react';
import { ClipboardList, PackageCheck, Plus, Trash2, Wallet } from 'lucide-react';
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
  useSuppliersQuery,
  usePurchaseOrdersQuery,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useReceiveGoods,
  useRecordSupplierPayment,
} from '@/hooks/queries';
import type { PurchaseOrder, PurchaseOrderStatus, PaymentMethod } from '@/types/business';
import { PAYMENT_METHODS } from '@/types/business';
import { dayKey, formatDate, roundMoney } from '@/lib/business';
import { MetricCard } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Draft',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  ordered: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  partially_received: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  received: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  mobile_wallet: 'Mobile wallet',
  cheque: 'Cheque',
  other: 'Other',
};

export function PurchasesBrowser() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const canManage = can(role, 'purchases.manage');
  const canReceive = can(role, 'purchases.receive');

  const { formatPrice } = useCurrency();
  const dates = useDateRange('last_30_days');
  const ordersQuery = usePurchaseOrdersQuery(dates.range);

  const [creating, setCreating] = React.useState(false);
  const [receiving, setReceiving] = React.useState<PurchaseOrder | null>(null);
  const [paying, setPaying] = React.useState<PurchaseOrder | null>(null);

  const orders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const totals = React.useMemo(() => {
    const live = orders.filter((order) => order.status !== 'cancelled');
    const committed = live
      .filter((order) => order.status === 'ordered' || order.status === 'partially_received')
      .reduce((sum, order) => sum + (order.total || 0), 0);
    const receivedValue = live.reduce(
      (sum, order) =>
        sum + order.items.reduce((lines, item) => lines + item.quantityReceived * item.unitCost, 0),
      0
    );
    return {
      count: live.length,
      committed: roundMoney(committed),
      receivedValue: roundMoney(receivedValue),
      awaiting: live.filter(
        (order) => order.status === 'ordered' || order.status === 'partially_received'
      ).length,
    };
  }, [orders]);

  return (
    <div>
      <PageHeader
        title="Purchases"
        description="Stock bought from suppliers. Receiving goods is what raises stock and sets cost."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="purchases"
              range={dates.range}
              getRows={() => orders}
              columns={[
                { header: 'PO number', value: (row) => row.purchaseOrderNumber },
                { header: 'Supplier', value: (row) => row.supplierName },
                { header: 'Status', value: (row) => STATUS_LABELS[row.status] },
                { header: 'Items', value: (row) => row.items.length },
                { header: 'Subtotal', value: (row) => row.subtotal },
                { header: 'Shipping', value: (row) => row.shippingCost },
                { header: 'Tax', value: (row) => row.taxAmount },
                { header: 'Total', value: (row) => row.total },
                { header: 'Currency', value: (row) => row.currency },
                { header: 'Expected', value: (row) => formatDate(row.expectedDeliveryAt) },
                { header: 'Delivered', value: (row) => formatDate(row.actualDeliveryAt) },
              ]}
            />
            {canManage && (
              <Button
                size="sm"
                variant="brand"
                className="rounded-lg"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" /> New purchase order
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Purchase orders"
          value={String(totals.count)}
          icon={ClipboardList}
          caption="Excludes cancelled"
          polarity="neutral"
          loading={ordersQuery.isLoading}
        />
        <MetricCard
          label="Awaiting delivery"
          value={String(totals.awaiting)}
          icon={PackageCheck}
          caption="Ordered or partially received"
          polarity="neutral"
          loading={ordersQuery.isLoading}
        />
        <MetricCard
          label="Committed spend"
          value={formatPrice(totals.committed)}
          icon={Wallet}
          caption="Ordered but not fully received"
          polarity="neutral"
          loading={ordersQuery.isLoading}
        />
        <MetricCard
          label="Goods received"
          value={formatPrice(totals.receivedValue)}
          icon={PackageCheck}
          caption="Value actually delivered"
          polarity="neutral"
          loading={ordersQuery.isLoading}
        />
      </div>

      <div className="border-border bg-card mt-6 rounded-xl border">
        <BreakdownTable
          rows={orders}
          rowKey={(row) => row.id}
          initialRows={20}
          empty={
            <EmptyState
              icon={ClipboardList}
              title="No purchase orders yet"
              description="Raise a purchase order to record what you bought, then receive it to add the stock and set its cost."
              action={
                canManage ? (
                  <Button
                    size="sm"
                    variant="brand"
                    className="rounded-lg"
                    onClick={() => setCreating(true)}
                  >
                    <Plus className="size-4" /> Create your first purchase order
                  </Button>
                ) : undefined
              }
            />
          }
          columns={[
            {
              key: 'number',
              header: 'Purchase order',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.purchaseOrderNumber}</p>
                  <p className="text-muted-foreground truncate text-xs">{row.supplierName}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLES[row.status]}`}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              ),
            },
            {
              key: 'progress',
              header: 'Received',
              align: 'right',
              hideOnMobile: true,
              cell: (row) => {
                const ordered = row.items.reduce((sum, item) => sum + item.quantity, 0);
                const received = row.items.reduce((sum, item) => sum + item.quantityReceived, 0);
                return `${received} / ${ordered}`;
              },
            },
            {
              key: 'expected',
              header: 'Expected',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDate(row.expectedDeliveryAt)}
                </span>
              ),
            },
            {
              key: 'total',
              header: 'Total',
              align: 'right',
              cell: (row) => formatPrice(row.total, row.currency),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (row) => (
                <PurchaseActions
                  order={row}
                  canManage={canManage}
                  canReceive={canReceive}
                  onReceive={() => setReceiving(row)}
                  onPay={() => setPaying(row)}
                />
              ),
            },
          ]}
        />
      </div>

      {creating && <CreatePurchaseOrderModal onClose={() => setCreating(false)} />}
      {receiving && <ReceiveGoodsModal order={receiving} onClose={() => setReceiving(null)} />}
      {paying && <RecordPaymentModal order={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}

/** Row actions, driven by the order's status. */
function PurchaseActions({
  order,
  canManage,
  canReceive,
  onReceive,
  onPay,
}: {
  order: PurchaseOrder;
  canManage: boolean;
  canReceive: boolean;
  onReceive: () => void;
  onPay: () => void;
}) {
  const toast = useToast();
  const updateStatus = useUpdatePurchaseOrderStatus();

  const canBeReceived = order.status === 'ordered' || order.status === 'partially_received';

  return (
    <div className="flex justify-end gap-1">
      {canManage && order.status === 'draft' && (
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg"
          disabled={updateStatus.isPending}
          onClick={() =>
            updateStatus.mutate(
              { id: order.id, status: 'ordered' },
              {
                onSuccess: () => toast.success(`${order.purchaseOrderNumber} marked as ordered.`),
                onError: (error) => toast.error(error.message),
              }
            )
          }
        >
          Place order
        </Button>
      )}

      {canReceive && canBeReceived && (
        <Button size="sm" variant="brand" className="rounded-lg" onClick={onReceive}>
          <PackageCheck className="size-3.5" /> Receive
        </Button>
      )}

      {canManage && order.status !== 'cancelled' && (
        <Button size="sm" variant="ghost" className="rounded-lg" onClick={onPay}>
          <Wallet className="size-3.5" />
          <span className="sr-only">Record payment for {order.purchaseOrderNumber}</span>
        </Button>
      )}
    </div>
  );
}

/** Draft line state inside the create form. */
interface DraftLine {
  productId: string;
  quantity: string;
  unitCost: string;
}

function CreatePurchaseOrderModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { currency } = useCurrency();
  const suppliersQuery = useSuppliersQuery(true);
  const productsQuery = useProductsQuery();
  const create = useCreatePurchaseOrder();

  const suppliers = suppliersQuery.data ?? [];
  const products = React.useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const [supplierId, setSupplierId] = React.useState('');
  const [lines, setLines] = React.useState<DraftLine[]>([
    { productId: '', quantity: '1', unitCost: '' },
  ]);
  const [shippingCost, setShippingCost] = React.useState('0');
  const [taxAmount, setTaxAmount] = React.useState('0');
  const [expected, setExpected] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [placeImmediately, setPlaceImmediately] = React.useState(true);

  const num = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const validLines = lines.filter(
    (line) => line.productId && num(line.quantity) > 0 && num(line.unitCost) >= 0
  );
  const subtotal = roundMoney(
    validLines.reduce((sum, line) => sum + num(line.quantity) * num(line.unitCost), 0)
  );
  const total = roundMoney(subtotal + num(shippingCost) + num(taxAmount));
  const canSubmit = Boolean(supplierId) && validLines.length > 0 && !create.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    create.mutate(
      {
        supplierId,
        lines: validLines.map((line) => {
          const product = products.find((entry) => entry.id === line.productId);
          return {
            productId: line.productId,
            title: product?.title ?? 'Unknown product',
            slug: product?.slug ?? '',
            quantity: Math.floor(num(line.quantity)),
            unitCost: num(line.unitCost),
          };
        }),
        shippingCost: num(shippingCost),
        taxAmount: num(taxAmount),
        currency,
        expectedDeliveryAt: expected ? new Date(`${expected}T00:00:00`) : null,
        notes: notes.trim(),
        placeImmediately,
      },
      {
        onSuccess: (order) => {
          toast.success(`Created ${order.purchaseOrderNumber}.`);
          onClose();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Modal open onClose={onClose} title="New purchase order" className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {suppliers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add an active supplier first — a purchase order must belong to one.
          </p>
        ) : (
          <Field label="Supplier" required>
            <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Select a supplier…</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-foreground text-sm font-medium">Items</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-lg"
              onClick={() =>
                setLines((current) => [...current, { productId: '', quantity: '1', unitCost: '' }])
              }
            >
              <Plus className="size-3.5" /> Add line
            </Button>
          </div>

          <div className="space-y-2">
            {lines.map((line, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    aria-label={`Product for line ${index + 1}`}
                    value={line.productId}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((entry, i) =>
                          i === index ? { ...entry, productId: event.target.value } : entry
                        )
                      )
                    }
                  >
                    <option value="">Select a product…</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  aria-label={`Quantity for line ${index + 1}`}
                  type="number"
                  min={1}
                  value={line.quantity}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, quantity: event.target.value } : entry
                      )
                    )
                  }
                  className="w-20 shrink-0"
                />
                <Input
                  aria-label={`Unit cost for line ${index + 1}`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Unit cost"
                  value={line.unitCost}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((entry, i) =>
                        i === index ? { ...entry, unitCost: event.target.value } : entry
                      )
                    )
                  }
                  className="w-28 shrink-0"
                />
                {lines.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="shrink-0 rounded-lg"
                    onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Remove line {index + 1}</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Shipping cost">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={shippingCost}
              onChange={(event) => setShippingCost(event.target.value)}
            />
          </Field>
          <Field label="Tax / fees">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={taxAmount}
              onChange={(event) => setTaxAmount(event.target.value)}
            />
          </Field>
          <Field label="Expected delivery">
            <Input
              type="date"
              value={expected}
              onChange={(event) => setExpected(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
          />
        </Field>

        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Order total</span>
          <span className="text-foreground font-semibold tabular-nums">
            {total.toFixed(2)} {currency}
          </span>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={placeImmediately}
            onChange={(event) => setPlaceImmediately(event.target.checked)}
            className="accent-brand mt-0.5 size-4"
          />
          <span>
            <span className="text-foreground font-medium">Place with the supplier now</span>
            <span className="text-muted-foreground block text-xs">
              Leave unchecked to save as a draft. Neither changes stock — only receiving does.
            </span>
          </span>
        </label>

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
            disabled={!canSubmit}
          >
            {create.isPending ? 'Creating…' : 'Create purchase order'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The receiving dialog — the only path in the app that raises stock. */
function ReceiveGoodsModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const toast = useToast();
  const receive = useReceiveGoods();

  const outstanding = order.items.map((item) => ({
    ...item,
    remaining: item.quantity - item.quantityReceived,
  }));

  const [lines, setLines] = React.useState(() =>
    outstanding.map((item) => ({
      productId: item.productId,
      quantity: String(item.remaining),
      unitCost: String(item.unitCost),
    }))
  );
  const [receivedAt, setReceivedAt] = React.useState(dayKey(new Date()));
  const [notes, setNotes] = React.useState('');

  const num = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const totalUnits = lines.reduce((sum, line) => sum + Math.floor(num(line.quantity)), 0);
  const totalValue = roundMoney(
    lines.reduce((sum, line) => sum + Math.floor(num(line.quantity)) * num(line.unitCost), 0)
  );
  const canSubmit = totalUnits > 0 && !receive.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive goods — ${order.purchaseOrderNumber}`}
      className="max-w-2xl"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          receive.mutate(
            {
              purchaseOrderId: order.id,
              receivedAt: new Date(`${receivedAt}T00:00:00`),
              notes: notes.trim(),
              lines: lines.map((line) => ({
                productId: line.productId,
                quantity: Math.floor(num(line.quantity)),
                unitCost: num(line.unitCost),
              })),
            },
            {
              onSuccess: (result) => {
                toast.success(
                  result.fullyReceived
                    ? `${order.purchaseOrderNumber} fully received — stock and costs updated.`
                    : `Partial receipt recorded for ${order.purchaseOrderNumber}.`
                );
                onClose();
              },
              onError: (error) => toast.error(error.message),
            }
          );
        }}
        className="space-y-4"
      >
        <p className="text-muted-foreground text-sm text-pretty">
          Enter what actually arrived and what you were actually charged. These costs feed each
          product’s weighted average, so they should match the supplier’s invoice.
        </p>

        <div className="space-y-3">
          {outstanding.map((item, index) => (
            <div key={item.productId} className="border-border rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-foreground truncate text-sm font-medium">{item.title}</p>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {item.remaining} outstanding
                </span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <Field label="Received" className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    max={item.remaining}
                    value={lines[index]?.quantity ?? '0'}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((line, i) =>
                          i === index ? { ...line, quantity: event.target.value } : line
                        )
                      )
                    }
                  />
                </Field>
                <Field label="Unit cost" className="flex-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={lines[index]?.unitCost ?? '0'}
                    onChange={(event) =>
                      setLines((current) =>
                        current.map((line, i) =>
                          i === index ? { ...line, unitCost: event.target.value } : line
                        )
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Received on" required>
            <Input
              type="date"
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
              max={dayKey(new Date())}
            />
          </Field>
          <Field label="Notes">
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
            />
          </Field>
        </div>

        <div className="border-border bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {totalUnits} unit{totalUnits === 1 ? '' : 's'} to receive
          </span>
          <span className="text-foreground font-semibold tabular-nums">
            {totalValue.toFixed(2)} {order.currency}
          </span>
        </div>

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
            disabled={!canSubmit}
          >
            {receive.isPending ? 'Receiving…' : 'Receive goods'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Records money paid to the supplier — separate from receiving the goods. */
function RecordPaymentModal({ order, onClose }: { order: PurchaseOrder; onClose: () => void }) {
  const toast = useToast();
  const record = useRecordSupplierPayment();

  const [amount, setAmount] = React.useState(String(order.total));
  const [method, setMethod] = React.useState<PaymentMethod>('bank_transfer');
  const [paidAt, setPaidAt] = React.useState(dayKey(new Date()));

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <Modal open onClose={onClose} title={`Record payment — ${order.purchaseOrderNumber}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid) return;
          record.mutate(
            {
              purchaseOrderId: order.id,
              amount: parsed,
              paymentMethod: method,
              paidAt: new Date(`${paidAt}T00:00:00`),
            },
            {
              onSuccess: () => {
                toast.success('Payment recorded in the cash ledger.');
                onClose();
              },
              onError: (error) => toast.error(error.message),
            }
          );
        }}
        className="space-y-4"
      >
        <p className="text-muted-foreground text-sm text-pretty">
          This records a cash outflow only. Paying for goods is separate from receiving them, so
          stock is not affected.
        </p>

        <Field label={`Amount (${order.currency})`} required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Payment method">
            <Select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((option) => (
                <option key={option} value={option}>
                  {METHOD_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Paid on" required>
            <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </Field>
        </div>

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
            disabled={!valid || record.isPending}
          >
            {record.isPending ? 'Saving…' : 'Record payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
