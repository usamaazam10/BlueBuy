/**
 * Sales calculations — the single source of truth for "how much did we sell?".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The definitions used throughout BlueBuy (these are NOT interchangeable):
 *
 *   Gross sales      Σ order.subtotal — line totals at the price charged,
 *                    before discounts and excluding shipping.
 *   Discounts        Σ order.discount.
 *   Refunds          Σ order.refundedAmount — money actually returned.
 *   Net sales        Gross sales − discounts − refunds.
 *   Shipping revenue Σ order.shipping — what the customer paid to receive it.
 *                    Kept OUT of net sales: it offsets a delivery cost, it is
 *                    not product revenue.
 *   Order value      Σ order.total — what customers were billed, shipping
 *                    included. This is the figure that should reconcile to cash.
 *
 * Cancelled and returned orders are excluded from all of the above — see
 * `NON_REVENUE_ORDER_STATUSES`. An order that was placed and then cancelled
 * never produced revenue, and counting it would overstate the business.
 *
 * Revenue is recognised at **order placement**, not at payment. Cash actually
 * received is a different number entirely and lives in `cashflow.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Order } from '@/types/order';
import { NON_REVENUE_ORDER_STATUSES } from '@/types/order';
import type { Product } from '@/types/models';
import type { DateRange } from './date-range';
import { dayKey, eachDayKey, isWithin, toDate } from './date-range';
import { roundMoney, safeDivide, sumMoney } from './metrics';

/** Whether an order contributes to revenue (i.e. isn't cancelled or returned). */
export function isRevenueOrder(order: Order): boolean {
  return !NON_REVENUE_ORDER_STATUSES.includes(order.status);
}

/** Orders whose `createdAt` falls inside a range. */
export function ordersInRange(orders: readonly Order[], range: DateRange): Order[] {
  return orders.filter((order) => isWithin(order.createdAt, range));
}

/** Units across an order's lines. */
export function orderUnits(order: Order): number {
  return order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/**
 * Cost of goods sold for one order, or `null` when it has no cost snapshot.
 *
 * `null` is deliberately distinct from `0`: it means "we don't know what these
 * goods cost", which must surface as *insufficient cost data* rather than as a
 * 100% margin. An incomplete snapshot (some lines had no cost basis) still
 * returns its partial total, but `costingComplete` reports the shortfall.
 */
export function orderCogs(order: Order): number | null {
  const costing = order.costing;
  if (!costing) return null;
  return roundMoney(costing.totalCost);
}

/** Whether an order carries a complete, trustworthy cost snapshot. */
export function hasCompleteCosting(order: Order): boolean {
  return Boolean(order.costing?.complete);
}

/** Headline sales figures for a set of orders. */
export interface SalesMetrics {
  /** Σ subtotal, before discounts, excluding shipping. */
  grossSales: number;
  discounts: number;
  refunds: number;
  /** Gross sales − discounts − refunds. */
  netSales: number;
  /** Σ shipping charged to customers. */
  shippingRevenue: number;
  /** Σ order totals (what customers were billed), less refunds. */
  orderValue: number;
  orderCount: number;
  unitsSold: number;
  /** Order value ÷ order count, or `null` with no orders. */
  averageOrderValue: number | null;
  /** Orders excluded from the figures above (cancelled/returned). */
  excludedOrderCount: number;
}

/**
 * Compute headline sales figures. Pass orders already filtered to the period;
 * non-revenue orders are dropped here so callers can't forget to.
 */
export function salesMetrics(orders: readonly Order[]): SalesMetrics {
  const revenue = orders.filter(isRevenueOrder);

  const grossSales = sumMoney(revenue.map((o) => o.subtotal || 0));
  const discounts = sumMoney(revenue.map((o) => o.discount || 0));
  const refunds = sumMoney(revenue.map((o) => o.refundedAmount || 0));
  const shippingRevenue = sumMoney(revenue.map((o) => o.shipping || 0));
  const billed = sumMoney(revenue.map((o) => o.total || 0));

  const netSales = roundMoney(grossSales - discounts - refunds);
  const orderValue = roundMoney(billed - refunds);
  const unitsSold = revenue.reduce((sum, o) => sum + orderUnits(o), 0);
  const average = safeDivide(orderValue, revenue.length);

  return {
    grossSales,
    discounts,
    refunds,
    netSales,
    shippingRevenue,
    orderValue,
    orderCount: revenue.length,
    unitsSold,
    averageOrderValue: average === null ? null : roundMoney(average),
    excludedOrderCount: orders.length - revenue.length,
  };
}

/** Cost-of-goods coverage across a set of orders. */
export interface CogsSummary {
  /** Σ captured cost across orders that have a snapshot. */
  total: number;
  /** Orders with a complete cost snapshot. */
  costedOrders: number;
  /** Revenue orders with no snapshot at all — their cost is unknown. */
  uncostedOrders: number;
  /** Orders whose snapshot was captured with some lines lacking a cost basis. */
  partialOrders: number;
  /**
   * True only when every revenue order in the set has a complete snapshot.
   * When false, gross profit must be labelled as incomplete rather than shown
   * as a confident number.
   */
  complete: boolean;
  /** Share of revenue orders with a usable snapshot, 0–100, or `null` if none. */
  coveragePercent: number | null;
}

/** Summarise how much of a period's COGS is actually known. */
export function cogsSummary(orders: readonly Order[]): CogsSummary {
  const revenue = orders.filter(isRevenueOrder);

  let total = 0;
  let costed = 0;
  let partial = 0;
  let uncosted = 0;

  for (const order of revenue) {
    const cost = orderCogs(order);
    if (cost === null) {
      uncosted += 1;
      continue;
    }
    total += cost;
    if (hasCompleteCosting(order)) costed += 1;
    else partial += 1;
  }

  const covered = costed + partial;
  const coverage = safeDivide(covered * 100, revenue.length);

  return {
    total: roundMoney(total),
    costedOrders: costed,
    uncostedOrders: uncosted,
    partialOrders: partial,
    complete: revenue.length > 0 && uncosted === 0 && partial === 0,
    coveragePercent: coverage === null ? null : Math.round(coverage * 10) / 10,
  };
}

// ──────────────────────────── Time series ────────────────────────────────────

/** One day of the sales chart. */
export interface SalesPoint {
  dayKey: string;
  netSales: number;
  orderValue: number;
  orders: number;
  units: number;
}

/**
 * Daily sales series across a range. Every day in the range is present, zero
 * included, so the chart has no gaps and no misleading interpolation.
 */
export function salesSeries(orders: readonly Order[], range: DateRange): SalesPoint[] {
  const buckets = new Map<string, SalesPoint>();
  for (const key of eachDayKey(range)) {
    buckets.set(key, { dayKey: key, netSales: 0, orderValue: 0, orders: 0, units: 0 });
  }

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    const date = toDate(order.createdAt);
    if (!date) continue;
    const bucket = buckets.get(dayKey(date));
    if (!bucket) continue;

    bucket.netSales += (order.subtotal || 0) - (order.discount || 0) - (order.refundedAmount || 0);
    bucket.orderValue += (order.total || 0) - (order.refundedAmount || 0);
    bucket.orders += 1;
    bucket.units += orderUnits(order);
  }

  return [...buckets.values()].map((point) => ({
    ...point,
    netSales: roundMoney(point.netSales),
    orderValue: roundMoney(point.orderValue),
  }));
}

// ──────────────────────────── Breakdowns ─────────────────────────────────────

/** A single row in a sales breakdown. */
export interface SalesBreakdownRow {
  key: string;
  label: string;
  revenue: number;
  units: number;
  orders: number;
  /** Captured cost for these lines, or `null` when no line had a cost basis. */
  cost: number | null;
  /** Revenue − cost, or `null` when cost is unknown. */
  grossProfit: number | null;
  /** Margin %, or `null` when cost is unknown. */
  marginPercent: number | null;
}

/** Accumulator used while grouping order lines. */
interface Accumulator {
  label: string;
  revenue: number;
  units: number;
  orderIds: Set<string>;
  cost: number;
  costKnown: boolean;
}

function finalise(key: string, acc: Accumulator): SalesBreakdownRow {
  const revenue = roundMoney(acc.revenue);
  const cost = acc.costKnown ? roundMoney(acc.cost) : null;
  const grossProfit = cost === null ? null : roundMoney(revenue - cost);
  const margin =
    grossProfit === null || revenue <= 0
      ? null
      : Math.round(((grossProfit / revenue) * 100 + Number.EPSILON) * 10) / 10;
  return {
    key,
    label: acc.label,
    revenue,
    units: acc.units,
    orders: acc.orderIds.size,
    cost,
    grossProfit,
    marginPercent: margin,
  };
}

/**
 * Group revenue order lines by a caller-supplied key.
 *
 * Cost comes from each order's captured cost snapshot, matched per line, so a
 * breakdown never re-prices history against today's purchase cost. A group is
 * only assigned a cost when at least one of its lines had one; groups with no
 * cost data report `null` and the UI shows "insufficient cost data".
 */
export function breakdownBy(
  orders: readonly Order[],
  keyOf: (line: { productId: string; title: string }) => { key: string; label: string } | null
): SalesBreakdownRow[] {
  const groups = new Map<string, Accumulator>();

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;

    // Index this order's captured unit costs by product for per-line lookup.
    const costByProduct = new Map<string, number>();
    for (const line of order.costing?.lines ?? []) {
      costByProduct.set(line.productId, line.unitCost);
    }

    for (const item of order.items) {
      const group = keyOf(item);
      if (!group) continue;

      let acc = groups.get(group.key);
      if (!acc) {
        acc = {
          label: group.label,
          revenue: 0,
          units: 0,
          orderIds: new Set(),
          cost: 0,
          costKnown: false,
        };
        groups.set(group.key, acc);
      }

      acc.revenue += item.lineTotal || 0;
      acc.units += item.quantity || 0;
      acc.orderIds.add(order.id);

      const unitCost = costByProduct.get(item.productId);
      if (typeof unitCost === 'number') {
        acc.cost += unitCost * (item.quantity || 0);
        acc.costKnown = true;
      }
    }
  }

  return [...groups.entries()]
    .map(([key, acc]) => finalise(key, acc))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Sales grouped by product. */
export function salesByProduct(orders: readonly Order[]): SalesBreakdownRow[] {
  return breakdownBy(orders, (line) => ({ key: line.productId, label: line.title }));
}

/**
 * Sales grouped by category. Needs the product catalogue to resolve each line's
 * `categoryId`; lines whose product no longer exists are grouped as "Unknown".
 */
export function salesByCategory(
  orders: readonly Order[],
  products: readonly Product[],
  categoryNames: ReadonlyMap<string, string>
): SalesBreakdownRow[] {
  const categoryByProduct = new Map(products.map((p) => [p.id, p.categoryId]));
  return breakdownBy(orders, (line) => {
    const categoryId = categoryByProduct.get(line.productId);
    if (!categoryId) return { key: '__unknown__', label: 'Unknown category' };
    return { key: categoryId, label: categoryNames.get(categoryId) ?? 'Unknown category' };
  });
}

/** Sales grouped by brand. */
export function salesByBrand(
  orders: readonly Order[],
  products: readonly Product[],
  brandNames: ReadonlyMap<string, string>
): SalesBreakdownRow[] {
  const brandByProduct = new Map(products.map((p) => [p.id, p.brandId]));
  return breakdownBy(orders, (line) => {
    const brandId = brandByProduct.get(line.productId);
    if (!brandId) return { key: '__unknown__', label: 'Unknown brand' };
    return { key: brandId, label: brandNames.get(brandId) ?? 'Unknown brand' };
  });
}

/** Order counts and value grouped by fulfilment status (all statuses). */
export function salesByStatus(
  orders: readonly Order[]
): { status: string; orders: number; value: number }[] {
  const groups = new Map<string, { orders: number; value: number }>();
  for (const order of orders) {
    const entry = groups.get(order.status) ?? { orders: 0, value: 0 };
    entry.orders += 1;
    entry.value += order.total || 0;
    groups.set(order.status, entry);
  }
  return [...groups.entries()]
    .map(([status, entry]) => ({ status, orders: entry.orders, value: roundMoney(entry.value) }))
    .sort((a, b) => b.orders - a.orders);
}

/**
 * Best sellers, ranked by revenue or by units.
 * Returns at most `limit` rows, already sorted.
 */
export function topProducts(
  orders: readonly Order[],
  by: 'revenue' | 'units',
  limit = 10
): SalesBreakdownRow[] {
  const rows = salesByProduct(orders);
  const sorted = by === 'units' ? [...rows].sort((a, b) => b.units - a.units) : rows;
  return sorted.slice(0, limit);
}

/**
 * Products whose revenue fell versus the previous period.
 *
 * Returns only products present in the earlier period — a product that simply
 * didn't exist before hasn't "declined", and reporting it as such would be
 * misleading.
 */
export interface DecliningProduct {
  key: string;
  label: string;
  currentRevenue: number;
  previousRevenue: number;
  change: number;
  changePercent: number;
}

export function decliningProducts(
  currentOrders: readonly Order[],
  previousOrders: readonly Order[],
  limit = 10
): DecliningProduct[] {
  const current = new Map(salesByProduct(currentOrders).map((row) => [row.key, row]));
  const previous = salesByProduct(previousOrders);

  const declines: DecliningProduct[] = [];
  for (const before of previous) {
    if (before.revenue <= 0) continue;
    const now = current.get(before.key);
    const currentRevenue = now?.revenue ?? 0;
    if (currentRevenue >= before.revenue) continue;

    const change = roundMoney(currentRevenue - before.revenue);
    declines.push({
      key: before.key,
      label: now?.label ?? before.label,
      currentRevenue,
      previousRevenue: before.revenue,
      change,
      changePercent: Math.round(((change / before.revenue) * 100 + Number.EPSILON) * 10) / 10,
    });
  }

  return declines.sort((a, b) => a.change - b.change).slice(0, limit);
}
