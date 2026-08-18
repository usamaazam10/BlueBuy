'use client';

import * as React from 'react';
import { Loader2, MapPin, Phone, Mail, StickyNote, User } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { can, useAuth } from '@/lib/auth';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';
import type { FirestoreDate } from '@/types/models';
import type { Order, OrderStatus } from '@/types/order';
import { nextStatuses, orderStatusLabel, isTerminalStatus } from '@/lib/order/status';
import { OrderStatusBadge } from './order-status-badge';

/**
 * Convert a Firestore date field to epoch millis, tolerating every shape it can
 * take: a `Date`, a live `Timestamp`, or the plain `{ seconds, nanoseconds }`
 * object a `Timestamp` degrades to after React Query's structural sharing.
 */
function toMillis(value: FirestoreDate): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  const seconds = (value as { seconds?: number })?.seconds;
  return typeof seconds === 'number' ? seconds * 1000 : 0;
}

/** Format a Firestore date field for display, gracefully handling nulls. */
function formatDateTime(value: FirestoreDate): string {
  const ms = toMillis(value);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

interface OrderDetailProps {
  order: Order | null;
  open: boolean;
  onClose: () => void;
  /** Called when an admin picks a new status. */
  /**
   * `restock` applies to a return: true puts the units back into sellable
   * stock, false records the return without restocking (goods came back
   * unsellable). Ignored for every other status.
   */
  onUpdateStatus: (order: Order, status: OrderStatus, restock?: boolean) => void;
  /** True while a status update is in flight. */
  updating?: boolean;
}

/** Small labelled row for the customer details block. */
function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-foreground text-sm break-words">{children}</p>
      </div>
    </div>
  );
}

/**
 * Slide-over showing a full order: customer + delivery details, line items,
 * money breakdown, and the status controls. Only the valid next statuses are
 * offered (see the lifecycle in `@/types/order`); moving to "cancelled" asks for
 * confirmation. All mutations are owned by the parent — this panel is a
 * controlled view.
 */
export function OrderDetail({ order, open, onClose, onUpdateStatus, updating }: OrderDetailProps) {
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [confirmReturn, setConfirmReturn] = React.useState(false);
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  // Cancelling or returning an order writes stock back and appends ledger
  // entries, so it needs inventory rights as well as order rights. Showing the
  // action to someone Firestore will refuse only produces a confusing error.
  const canCloseOrder = can(user?.role ?? 'viewer', 'inventory.adjust');
  // Orders render in the currency they were placed with, not the store's
  // current one, so a past order never silently changes value.
  const money = (value: number) => formatPrice(value, order?.currency);

  if (!order) {
    return (
      <Drawer open={open} onClose={onClose} title="Order" className="max-w-md">
        {null}
      </Drawer>
    );
  }

  const closingStatuses: OrderStatus[] = ['cancelled', 'returned'];
  const transitions = nextStatuses(order.status).filter(
    (status) => canCloseOrder || !closingStatuses.includes(status)
  );
  const terminal = isTerminalStatus(order.status);
  const hiddenClosingActions =
    !canCloseOrder && nextStatuses(order.status).some((s) => closingStatuses.includes(s));

  return (
    <Drawer open={open} onClose={onClose} title={order.orderId} className="max-w-md">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-5">
          {/* Status + placed date */}
          <div className="flex items-center justify-between gap-3">
            <OrderStatusBadge status={order.status} />
            <span className="text-muted-foreground text-xs">{formatDateTime(order.createdAt)}</span>
          </div>

          {/* Customer */}
          <section className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Customer
            </h3>
            <div className="space-y-3">
              <InfoRow icon={User} label="Name">
                {order.customer.fullName}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                <a href={`tel:${order.customer.phone}`} className="hover:text-brand">
                  {order.customer.phone}
                </a>
              </InfoRow>
              {order.customer.email && (
                <InfoRow icon={Mail} label="Email">
                  <a href={`mailto:${order.customer.email}`} className="hover:text-brand">
                    {order.customer.email}
                  </a>
                </InfoRow>
              )}
              <InfoRow icon={MapPin} label="Delivery address">
                {order.customer.address}, {order.customer.city}
              </InfoRow>
              {order.customer.notes && (
                <InfoRow icon={StickyNote} label="Notes">
                  {order.customer.notes}
                </InfoRow>
              )}
            </div>
          </section>

          {/* Items */}
          <section className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Items ({order.items.length})
            </h3>
            <ul className="divide-border border-border divide-y rounded-xl border">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 p-3">
                  <span
                    className="border-border size-10 shrink-0 overflow-hidden rounded-lg border"
                    style={{ backgroundColor: `${item.accent}20` }}
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">{item.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {money(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{money(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Totals */}
          <section className="border-border space-y-2 border-t pt-4 text-sm">
            <div className="text-muted-foreground flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="text-muted-foreground flex justify-between">
                <span>Discount</span>
                <span className="tabular-nums">−{money(order.discount)}</span>
              </div>
            )}
            <div className="text-muted-foreground flex justify-between">
              <span>Shipping</span>
              <span className="tabular-nums">
                {order.shipping === 0 ? 'Free' : money(order.shipping)}
              </span>
            </div>
            <div className="text-foreground flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{money(order.total)}</span>
            </div>
          </section>
        </div>
      </div>

      {/* Status controls (sticky footer) */}
      <footer className="border-border space-y-3 border-t p-5">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Update status
        </p>
        {terminal ? (
          <p className="text-muted-foreground text-sm">
            This order is {orderStatusLabel(order.status).toLowerCase()} — no further changes.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {transitions.map((status) => {
              const destructive = status === 'cancelled';
              const isReturn = status === 'returned';
              return (
                <Button
                  key={status}
                  size="sm"
                  variant={destructive ? 'outline' : 'brand'}
                  className={cn(
                    'rounded-lg',
                    destructive && 'border-destructive/40 text-destructive hover:bg-destructive/10'
                  )}
                  disabled={updating}
                  onClick={() => {
                    if (destructive) return setConfirmCancel(true);
                    if (isReturn) return setConfirmReturn(true);
                    return onUpdateStatus(order, status);
                  }}
                >
                  {updating ? <Loader2 className="size-4 animate-spin" /> : null}
                  {status === 'cancelled' ? 'Cancel order' : `Mark ${orderStatusLabel(status)}`}
                </Button>
              );
            })}
          </div>
        )}
        {hiddenClosingActions ? (
          <p className="text-muted-foreground text-xs">
            Cancelling or returning an order also moves stock, which your role can&rsquo;t do. Ask
            an admin or the inventory manager.
          </p>
        ) : null}
      </footer>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => onUpdateStatus(order, 'cancelled')}
        title={`Cancel order ${order.orderId}?`}
        description="This cancels the order and returns its items to sellable stock, recording the movement in the inventory ledger. This can't be undone."
        confirmLabel="Cancel order"
      />

      {/*
        A return has two very different inventory outcomes and the system must
        not guess: goods that come back saleable go straight back on the shelf,
        goods that come back damaged must not. Both record the sale in the
        ledger; only one adds the units back.
      */}
      <Modal
        open={confirmReturn}
        onClose={() => setConfirmReturn(false)}
        title={`Return order ${order.orderId}?`}
        className="max-w-md"
      >
        <div className="space-y-4 p-5 pt-0">
          <p className="text-muted-foreground text-sm">
            What happened to the {order.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
            returned unit
            {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? '' : 's'}?
          </p>
          <div className="flex flex-col gap-2">
            <Button
              variant="brand"
              className="rounded-lg"
              disabled={updating}
              onClick={() => {
                setConfirmReturn(false);
                onUpdateStatus(order, 'returned', true);
              }}
            >
              Back to sellable stock
            </Button>
            <Button
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 rounded-lg"
              disabled={updating}
              onClick={() => {
                setConfirmReturn(false);
                onUpdateStatus(order, 'returned', false);
              }}
            >
              Write off &mdash; came back unsellable
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Either way the order stops counting as revenue and its sale is recorded in the inventory
            ledger. Only &ldquo;back to sellable stock&rdquo; raises the stock level.
          </p>
        </div>
      </Modal>
    </Drawer>
  );
}
