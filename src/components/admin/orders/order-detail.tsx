'use client';

import * as React from 'react';
import { Loader2, MapPin, Phone, Mail, StickyNote, User } from 'lucide-react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/admin/ui/confirm-dialog';
import { formatPrice } from '@/lib/format';
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
  onUpdateStatus: (order: Order, status: OrderStatus) => void;
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

  if (!order) {
    return (
      <Drawer open={open} onClose={onClose} title="Order" className="max-w-md">
        {null}
      </Drawer>
    );
  }

  const transitions = nextStatuses(order.status);
  const terminal = isTerminalStatus(order.status);

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
                      {formatPrice(item.unitPrice)} × {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {formatPrice(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Totals */}
          <section className="border-border space-y-2 border-t pt-4 text-sm">
            <div className="text-muted-foreground flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="text-muted-foreground flex justify-between">
                <span>Discount</span>
                <span className="tabular-nums">−{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="text-muted-foreground flex justify-between">
              <span>Shipping</span>
              <span className="tabular-nums">
                {order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}
              </span>
            </div>
            <div className="text-foreground flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPrice(order.total)}</span>
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
                  onClick={() =>
                    destructive ? setConfirmCancel(true) : onUpdateStatus(order, status)
                  }
                >
                  {updating ? <Loader2 className="size-4 animate-spin" /> : null}
                  {status === 'cancelled' ? 'Cancel order' : `Mark ${orderStatusLabel(status)}`}
                </Button>
              );
            })}
          </div>
        )}
      </footer>

      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => onUpdateStatus(order, 'cancelled')}
        title={`Cancel order ${order.orderId}?`}
        description="This marks the order as cancelled. Stock is not automatically restored. This can't be undone."
        confirmLabel="Cancel order"
      />
    </Drawer>
  );
}
