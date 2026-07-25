/**
 * Order status presentation + transition helpers.
 *
 * The lifecycle itself (the states and their allowed transitions) is defined
 * once in `@/types/order`. This module layers the *UI* concerns on top: labels,
 * a short description per state, and the tint used by the status badge — so the
 * admin renders every status consistently and only ever offers valid next
 * states when updating an order.
 */
import { ORDER_STATUS_FLOW, type OrderStatus } from '@/types/order';

/** Visual + textual metadata for a status. `tone` maps to badge tint classes. */
export interface OrderStatusMeta {
  label: string;
  description: string;
  /** Colour family for the badge; mirrors the storefront status tint palette. */
  tone: 'amber' | 'sky' | 'violet' | 'indigo' | 'emerald' | 'rose';
}

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  pending: {
    label: 'Pending',
    description: 'Order received, awaiting confirmation.',
    tone: 'amber',
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Order confirmed and queued for packing.',
    tone: 'sky',
  },
  packed: {
    label: 'Packed',
    description: 'Items packed and ready to ship.',
    tone: 'violet',
  },
  shipped: {
    label: 'Shipped',
    description: 'Handed to the courier and on its way.',
    tone: 'indigo',
  },
  delivered: {
    label: 'Delivered',
    description: 'Delivered to the customer.',
    tone: 'emerald',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Order cancelled.',
    tone: 'rose',
  },
};

/** Human-readable label for a status. */
export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_META[status].label;
}

/** Statuses an order may be moved to from its current status (excludes itself). */
export function nextStatuses(status: OrderStatus): readonly OrderStatus[] {
  return ORDER_STATUS_FLOW[status];
}

/** Whether moving from `from` to `to` is a permitted transition. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_FLOW[from].includes(to);
}

/** Whether a status is terminal (no further transitions possible). */
export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_STATUS_FLOW[status].length === 0;
}
