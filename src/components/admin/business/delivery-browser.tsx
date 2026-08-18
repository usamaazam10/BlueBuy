'use client';

/**
 * Delivery dashboard — where every open order physically is, and how well
 * deliveries are going.
 *
 * The fulfilment panel here is where courier details, payments and refunds are
 * recorded. It deliberately sits alongside the orders list rather than replacing
 * it: the orders page is for browsing and status, this is for the operational
 * work of getting goods to customers.
 *
 * No courier integration is implied or faked. Tracking numbers are recorded, not
 * looked up — see BUSINESS_OPERATIONS.md § Delivery for where an integration
 * would slot in.
 */
import * as React from 'react';
import { Clock, PackageCheck, Truck, TriangleAlert, Undo2, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/admin/ui/page-header';
import { EmptyState } from '@/components/admin/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Field, Input, Select, Textarea } from '@/components/admin/ui/control';
import { useToast } from '@/components/ui/toast';
import { OrderStatusBadge } from '@/components/admin/orders/order-status-badge';
import { useAuth, can } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import {
  useOrdersQuery,
  useUpdateOrderDelivery,
  useRecordCustomerPayment,
  useRecordRefund,
  useOrderPaymentsQuery,
} from '@/hooks/queries';
import type { Order } from '@/types/order';
import type { PaymentMethod } from '@/types/business';
import { PAYMENT_METHODS } from '@/types/business';
import {
  courierPerformance,
  dayKey,
  deliverySummary,
  formatDate,
  openOrders,
  resolveDateRange,
  toDate,
} from '@/lib/business';
import { MetricCard, DataQualityNote } from './metric-card';
import { BreakdownTable } from './breakdown-table';
import { DateRangePicker, useDateRange } from './date-range-picker';
import { ExportButton } from './export-button';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  card: 'Card',
  mobile_wallet: 'Mobile wallet',
  cheque: 'Cheque',
  other: 'Other',
};

export function DeliveryBrowser() {
  const { user } = useAuth();
  const role = user?.role ?? 'viewer';
  const canManage = can(role, 'orders.manage');
  const showFinance = can(role, 'finance.view');

  const { formatPrice } = useCurrency();
  const dates = useDateRange('last_30_days');
  const ordersQuery = useOrdersQuery();

  const [fulfilling, setFulfilling] = React.useState<Order | null>(null);

  const orders = React.useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const today = React.useMemo(() => resolveDateRange('today'), []);

  const summary = React.useMemo(
    () => deliverySummary(orders, dates.range, today),
    [orders, dates.range, today]
  );
  const couriers = React.useMemo(() => courierPerformance(orders), [orders]);
  const open = React.useMemo(
    () =>
      [...openOrders(orders)].sort(
        (a, b) => (toDate(a.createdAt)?.getTime() ?? 0) - (toDate(b.createdAt)?.getTime() ?? 0)
      ),
    [orders]
  );

  return (
    <div>
      <PageHeader
        title="Deliveries"
        description="Where every open order is, and how deliveries are performing."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker state={dates} />
            <ExportButton
              kind="deliveries"
              range={dates.range}
              getRows={() => open}
              columns={[
                { header: 'Order', value: (row) => row.orderId },
                { header: 'Customer', value: (row) => row.customer.fullName },
                { header: 'City', value: (row) => row.customer.city },
                { header: 'Status', value: (row) => row.status },
                { header: 'Courier', value: (row) => row.delivery?.courier ?? '' },
                { header: 'Tracking', value: (row) => row.delivery?.trackingNumber ?? '' },
                {
                  header: 'Expected',
                  value: (row) => formatDate(row.delivery?.expectedDeliveryAt),
                },
                { header: 'Placed', value: (row) => formatDate(row.createdAt) },
                { header: 'Total', value: (row) => row.total },
              ]}
            />
          </div>
        }
      />

      {/* Pipeline */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.stages.map((stage) => (
          <MetricCard
            key={stage.key}
            label={stage.label}
            value={String(stage.count)}
            icon={stage.key === 'awaiting' ? Clock : stage.key === 'packed' ? PackageCheck : Truck}
            caption="Open orders"
            polarity="neutral"
            loading={ordersQuery.isLoading}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Delivered today"
          value={String(summary.deliveredToday)}
          icon={PackageCheck}
          caption="Completed deliveries"
          loading={ordersQuery.isLoading}
        />
        <MetricCard
          label="Failed deliveries"
          value={String(summary.failedDeliveries)}
          icon={TriangleAlert}
          caption="All time"
          polarity="lower_is_better"
          loading={ordersQuery.isLoading}
        />
        <MetricCard
          label="Returns"
          value={String(summary.returns)}
          icon={Undo2}
          caption="Goods came back"
          polarity="lower_is_better"
          loading={ordersQuery.isLoading}
        />
        <MetricCard
          label="Delivery success rate"
          value={summary.successRate === null ? null : `${summary.successRate}%`}
          unavailableReason={
            summary.successRate === null
              ? 'Not enough completed deliveries yet to state a rate.'
              : undefined
          }
          icon={PackageCheck}
          caption="Delivered ÷ all attempts"
          loading={ordersQuery.isLoading}
        />
      </div>

      {summary.averageDeliveryDays !== null ? (
        <DataQualityNote
          className="mt-4"
          tone="info"
          message={`Average delivery time is ${summary.averageDeliveryDays} days, measured across ${summary.averageSampleSize} deliveries that have both a despatch and a delivery date recorded.`}
        />
      ) : (
        <DataQualityNote
          className="mt-4"
          tone="info"
          message={`Average delivery time needs at least 10 deliveries with both a despatch and a delivery date. So far ${summary.averageSampleSize} qualify — record shipped and delivered dates below to build the figure.`}
        />
      )}

      {/* Open orders */}
      <div className="border-border bg-card mt-6 rounded-xl border">
        <div className="border-border border-b px-5 py-4">
          <h2 className="text-foreground text-sm font-semibold">Orders to fulfil</h2>
          <p className="text-muted-foreground text-xs">Oldest first — these have waited longest.</p>
        </div>
        <BreakdownTable
          rows={open}
          rowKey={(row) => row.id}
          initialRows={20}
          empty={
            <EmptyState
              icon={PackageCheck}
              title="Nothing waiting"
              description="Every order has been delivered, returned or cancelled."
            />
          }
          columns={[
            {
              key: 'order',
              header: 'Order',
              cell: (row) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.orderId}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.customer.fullName} · {row.customer.city}
                  </p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) => <OrderStatusBadge status={row.status} />,
            },
            {
              key: 'courier',
              header: 'Courier',
              hideOnMobile: true,
              cell: (row) =>
                row.delivery?.courier ? (
                  <div className="min-w-0">
                    <p className="truncate text-xs">{row.delivery.courier}</p>
                    {row.delivery.trackingNumber && (
                      <p className="text-muted-foreground truncate text-xs">
                        {row.delivery.trackingNumber}
                      </p>
                    )}
                  </div>
                ) : null,
            },
            {
              key: 'placed',
              header: 'Placed',
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-muted-foreground text-xs whitespace-nowrap">
                  {formatDate(row.createdAt)}
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
              cell: (row) =>
                canManage ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    onClick={() => setFulfilling(row)}
                  >
                    <Truck className="size-3.5" /> Fulfil
                  </Button>
                ) : null,
            },
          ]}
        />
      </div>

      {/* Couriers */}
      {couriers.length > 0 && (
        <div className="border-border bg-card mt-6 rounded-xl border">
          <div className="border-border border-b px-5 py-4">
            <h2 className="text-foreground text-sm font-semibold">Courier performance</h2>
            <p className="text-muted-foreground text-xs">
              Recorded from your own deliveries — no courier integration is connected.
            </p>
          </div>
          <BreakdownTable
            rows={couriers}
            rowKey={(row) => row.courier}
            empty={<p className="text-muted-foreground px-5 py-8 text-sm">No couriers recorded.</p>}
            columns={[
              { key: 'courier', header: 'Courier', cell: (row) => row.courier },
              { key: 'shipped', header: 'Shipped', align: 'right', cell: (row) => row.shipped },
              {
                key: 'delivered',
                header: 'Delivered',
                align: 'right',
                cell: (row) => row.delivered,
              },
              {
                key: 'failed',
                header: 'Failed',
                align: 'right',
                hideOnMobile: true,
                cell: (row) => row.failed,
              },
              {
                key: 'avg',
                header: 'Avg days',
                align: 'right',
                hideOnMobile: true,
                cell: (row) => (row.averageDeliveryDays === null ? null : row.averageDeliveryDays),
              },
              {
                key: 'rate',
                header: 'Success',
                align: 'right',
                cell: (row) => (row.successRate === null ? null : `${row.successRate}%`),
              },
            ]}
          />
        </div>
      )}

      {fulfilling && (
        <FulfilmentModal
          order={fulfilling}
          showFinance={showFinance}
          onClose={() => setFulfilling(null)}
        />
      )}
    </div>
  );
}

/** Courier details, plus payment and refund recording for one order. */
function FulfilmentModal({
  order,
  showFinance,
  onClose,
}: {
  order: Order;
  showFinance: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const updateDelivery = useUpdateOrderDelivery();
  const recordPayment = useRecordCustomerPayment();
  const recordRefund = useRecordRefund();
  const paymentsQuery = useOrderPaymentsQuery(order.id);

  const existing = order.delivery;
  const asInput = (value: unknown) => {
    const date = toDate(value as never);
    return date ? dayKey(date) : '';
  };

  const [courier, setCourier] = React.useState(existing?.courier ?? '');
  const [tracking, setTracking] = React.useState(existing?.trackingNumber ?? '');
  const [cost, setCost] = React.useState(String(existing?.deliveryCost ?? 0));
  const [shippedAt, setShippedAt] = React.useState(asInput(existing?.shippedAt));
  const [expectedAt, setExpectedAt] = React.useState(asInput(existing?.expectedDeliveryAt));
  const [deliveredAt, setDeliveredAt] = React.useState(asInput(existing?.deliveredAt));
  const [notes, setNotes] = React.useState(existing?.notes ?? '');

  const [payAmount, setPayAmount] = React.useState(String(order.total));
  const [payMethod, setPayMethod] = React.useState<PaymentMethod>('cash');

  const paid = (paymentsQuery.data ?? [])
    .filter((entry) => entry.direction === 'inflow')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const outstanding = Math.max(0, order.total - paid);

  const toDateOrNull = (value: string) => (value ? new Date(`${value}T00:00:00`) : null);

  const handleSaveDelivery = (event: React.FormEvent) => {
    event.preventDefault();
    updateDelivery.mutate(
      {
        id: order.id,
        delivery: {
          courier: courier.trim(),
          trackingNumber: tracking.trim(),
          deliveryCost: Number.parseFloat(cost) || 0,
          shippedAt: toDateOrNull(shippedAt),
          expectedDeliveryAt: toDateOrNull(expectedAt),
          deliveredAt: toDateOrNull(deliveredAt),
          notes: notes.trim(),
        },
      },
      {
        onSuccess: () => {
          toast.success('Delivery details saved.');
          onClose();
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Modal open onClose={onClose} title={`Fulfil ${order.orderId}`} className="max-w-2xl">
      <div className="space-y-6">
        <div className="border-border bg-muted/40 rounded-lg border p-3 text-sm">
          <p className="text-foreground font-medium">{order.customer.fullName}</p>
          <p className="text-muted-foreground text-xs">
            {order.customer.address}, {order.customer.city} · {order.customer.phone}
          </p>
        </div>

        <form onSubmit={handleSaveDelivery} className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold">Courier &amp; tracking</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Courier">
              <Input
                value={courier}
                onChange={(event) => setCourier(event.target.value)}
                maxLength={120}
                placeholder="e.g. TCS, Leopards"
              />
            </Field>
            <Field label="Tracking number">
              <Input
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                maxLength={120}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Shipped on">
              <Input
                type="date"
                value={shippedAt}
                onChange={(event) => setShippedAt(event.target.value)}
              />
            </Field>
            <Field label="Expected">
              <Input
                type="date"
                value={expectedAt}
                onChange={(event) => setExpectedAt(event.target.value)}
              />
            </Field>
            <Field label="Delivered on">
              <Input
                type="date"
                value={deliveredAt}
                onChange={(event) => setDeliveredAt(event.target.value)}
              />
            </Field>
          </div>

          {showFinance && (
            <Field
              label="Delivery cost"
              hint="What the courier charges you. Record it as a shipping expense to include it in profit."
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
              />
            </Field>
          )}

          <Field label="Delivery notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="sm"
              className="rounded-lg"
              disabled={updateDelivery.isPending}
            >
              {updateDelivery.isPending ? 'Saving…' : 'Save delivery details'}
            </Button>
          </div>
        </form>

        {showFinance && (
          <div className="border-border space-y-4 border-t pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-foreground text-sm font-semibold">Payment</h3>
              <p className="text-muted-foreground text-xs">
                {formatPrice(paid, order.currency)} received of{' '}
                {formatPrice(order.total, order.currency)}
                {outstanding > 0 && ` · ${formatPrice(outstanding, order.currency)} outstanding`}
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <Field label={`Amount (${order.currency})`} className="flex-1">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={payAmount}
                  onChange={(event) => setPayAmount(event.target.value)}
                />
              </Field>
              <Field label="Method" className="flex-1">
                <Select
                  value={payMethod}
                  onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}
                >
                  {PAYMENT_METHODS.map((option) => (
                    <option key={option} value={option}>
                      {METHOD_LABELS[option]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="brand"
                className="rounded-lg"
                disabled={recordPayment.isPending}
                onClick={() =>
                  recordPayment.mutate(
                    {
                      orderId: order.id,
                      amount: Number.parseFloat(payAmount) || 0,
                      paymentMethod: payMethod,
                      receivedAt: new Date(),
                    },
                    {
                      onSuccess: () => toast.success('Payment recorded in the cash ledger.'),
                      onError: (error) => toast.error(error.message),
                    }
                  )
                }
              >
                <Wallet className="size-3.5" /> Record payment received
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={recordRefund.isPending}
                onClick={() =>
                  recordRefund.mutate(
                    {
                      orderId: order.id,
                      amount: Number.parseFloat(payAmount) || 0,
                      paymentMethod: payMethod,
                      refundedAt: new Date(),
                    },
                    {
                      onSuccess: () => toast.success('Refund recorded.'),
                      onError: (error) => toast.error(error.message),
                    }
                  )
                }
              >
                <Undo2 className="size-3.5" /> Record refund
              </Button>
            </div>

            <p className="text-muted-foreground text-xs text-pretty">
              Payments and refunds move cash only — they don’t change the order’s status or its
              stock. Cancel or return the order from the Orders page to put items back in stock.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
