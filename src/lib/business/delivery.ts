/**
 * Delivery and fulfilment calculations.
 *
 * Operational, not financial: this module answers "what is sitting in the
 * warehouse, what is with a courier, and how well are deliveries going?".
 *
 * Average delivery time and success rate both refuse to report on thin data —
 * a 100% success rate from two deliveries is not a performance figure.
 */
import type { Order, OrderStatus } from '@/types/order';
import { CLOSED_ORDER_STATUSES } from '@/types/order';
import type { DateRange } from './date-range';
import { isWithin, toMillis } from './date-range';
import { percentOf, roundPercent } from './metrics';

/**
 * Below this many completed delivery attempts, a success rate or average
 * delivery time is not reported. Small numbers swing wildly and would read as
 * a trend when they are a coincidence.
 */
export const MIN_DELIVERIES_FOR_RATE = 10;

/** Statuses grouped by where the goods physically are. */
export const FULFILMENT_STAGES: { key: string; label: string; statuses: OrderStatus[] }[] = [
  {
    key: 'awaiting',
    label: 'Awaiting fulfilment',
    statuses: ['pending', 'confirmed', 'processing'],
  },
  { key: 'packed', label: 'Packed', statuses: ['packed', 'ready_for_dispatch'] },
  { key: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { key: 'out_for_delivery', label: 'Out for delivery', statuses: ['out_for_delivery'] },
];

export interface DeliverySummary {
  /** Open orders per fulfilment stage. */
  stages: { key: string; label: string; count: number }[];
  /** Orders still open (not delivered, returned or cancelled). */
  openOrders: number;
  /** Delivered within the selected period. */
  deliveredInPeriod: number;
  /** Delivered today, regardless of the selected period. */
  deliveredToday: number;
  failedDeliveries: number;
  returns: number;
  /**
   * Mean days from shipped to delivered, or `null` when too few deliveries
   * carry both timestamps.
   */
  averageDeliveryDays: number | null;
  /** How many deliveries the average is based on. */
  averageSampleSize: number;
  /**
   * Delivered ÷ (delivered + failed + returned) as a percentage, or `null`
   * below the reporting threshold.
   */
  successRate: number | null;
}

/** Orders that are still moving through fulfilment. */
export function openOrders(orders: readonly Order[]): Order[] {
  return orders.filter((order) => !CLOSED_ORDER_STATUSES.includes(order.status));
}

/**
 * Days between despatch and delivery for one order, or `null` when either
 * timestamp is missing. Only orders with both can contribute to the average.
 */
export function deliveryDays(order: Order): number | null {
  const shipped = toMillis(order.delivery?.shippedAt);
  const delivered = toMillis(order.delivery?.deliveredAt);
  if (shipped === null || delivered === null) return null;
  const days = (delivered - shipped) / 86_400_000;
  // A negative span means the dates were entered the wrong way round; excluding
  // it is better than letting it drag the average below zero.
  return days < 0 ? null : days;
}

export function deliverySummary(
  orders: readonly Order[],
  range: DateRange,
  today: DateRange
): DeliverySummary {
  const open = openOrders(orders);

  const stages = FULFILMENT_STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    count: open.filter((order) => stage.statuses.includes(order.status)).length,
  }));

  const delivered = orders.filter((order) => order.status === 'delivered');
  const failed = orders.filter((order) => order.status === 'delivery_failed');
  const returned = orders.filter((order) => order.status === 'returned');

  const deliveredInPeriod = delivered.filter(
    (order) => isWithin(order.delivery?.deliveredAt, range) || isWithin(order.updatedAt, range)
  ).length;

  const deliveredToday = delivered.filter(
    (order) => isWithin(order.delivery?.deliveredAt, today) || isWithin(order.updatedAt, today)
  ).length;

  const spans = delivered.map(deliveryDays).filter((days): days is number => days !== null);

  const attempts = delivered.length + failed.length + returned.length;

  return {
    stages,
    openOrders: open.length,
    deliveredInPeriod,
    deliveredToday,
    failedDeliveries: failed.length,
    returns: returned.length,
    averageDeliveryDays:
      spans.length >= MIN_DELIVERIES_FOR_RATE
        ? roundPercent(spans.reduce((sum, days) => sum + days, 0) / spans.length)
        : null,
    averageSampleSize: spans.length,
    successRate: attempts >= MIN_DELIVERIES_FOR_RATE ? percentOf(delivered.length, attempts) : null,
  };
}

/** Courier performance, for deciding who to keep using. */
export interface CourierRow {
  courier: string;
  shipped: number;
  delivered: number;
  failed: number;
  averageDeliveryDays: number | null;
  successRate: number | null;
}

export function courierPerformance(orders: readonly Order[]): CourierRow[] {
  const groups = new Map<
    string,
    { shipped: number; delivered: number; failed: number; spans: number[] }
  >();

  for (const order of orders) {
    const courier = order.delivery?.courier?.trim();
    if (!courier) continue;

    const entry = groups.get(courier) ?? { shipped: 0, delivered: 0, failed: 0, spans: [] };
    entry.shipped += 1;
    if (order.status === 'delivered') entry.delivered += 1;
    if (order.status === 'delivery_failed') entry.failed += 1;

    const days = deliveryDays(order);
    if (days !== null) entry.spans.push(days);

    groups.set(courier, entry);
  }

  return [...groups.entries()]
    .map(([courier, entry]) => {
      const attempts = entry.delivered + entry.failed;
      return {
        courier,
        shipped: entry.shipped,
        delivered: entry.delivered,
        failed: entry.failed,
        averageDeliveryDays:
          entry.spans.length >= MIN_DELIVERIES_FOR_RATE
            ? roundPercent(entry.spans.reduce((sum, d) => sum + d, 0) / entry.spans.length)
            : null,
        successRate:
          attempts >= MIN_DELIVERIES_FOR_RATE ? percentOf(entry.delivered, attempts) : null,
      };
    })
    .sort((a, b) => b.shipped - a.shipped);
}
