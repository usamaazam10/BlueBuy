/**
 * Inventory cost basis — **weighted average cost (WAC)**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why weighted average?
 *
 * FIFO/LIFO require tracking individual cost layers ("lots") and consuming them
 * in order. That needs a serialised, server-side writer to stay correct under
 * concurrent sales — which this architecture does not have: BlueBuy is a static
 * export with no server runtime, and the checkout decrements stock from an
 * unauthenticated browser. WAC needs only a single running number per product,
 * is order-independent, and converges to the same total cost over the life of a
 * product. It is the honest choice for this system rather than a FIFO ledger
 * that would quietly go wrong.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * How it works
 *
 * Each purchase receipt folds its cost into the running average:
 *
 *     newAverage = (stockOnHand × currentAverage + qtyReceived × unitCost)
 *                  ─────────────────────────────────────────────────────────
 *                                stockOnHand + qtyReceived
 *
 * Sales do **not** change the average — they consume units at it. The cost of a
 * sale is snapshotted onto the order (see `OrderCosting`) at fulfilment time, so
 * later purchases at different prices never rewrite historical margin.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Unknown cost is not zero
 *
 * A product that has never been received and has no manually entered cost has
 * **no cost basis**. Every function here returns `null` for that case, and the
 * reporting layer renders "insufficient cost data" rather than treating the
 * goods as free and reporting 100% margin. This is the single most important
 * rule in this file.
 */
import type { Product } from '@/types/models';
import { roundMoney } from './metrics';

/** Where a product's unit cost came from, in order of authority. */
export type CostSource = 'weighted_average' | 'last_purchase' | 'manual';

export interface CostBasis {
  /** Cost of one unit. */
  unitCost: number;
  source: CostSource;
}

/**
 * Resolve a product's cost basis, or `null` when none is known.
 *
 * Precedence:
 *  1. `averageCost` — maintained by purchase receipts; the real cost basis.
 *  2. `lastPurchaseCost` — a product received before averages were tracked.
 *  3. `costPrice` — a figure the operator typed in by hand.
 *
 * A stored `0` is treated as a genuine zero cost (free stock, samples) only when
 * it came from a receipt; a `null`/absent field means unknown.
 */
export function costBasis(
  product: Pick<Product, 'averageCost' | 'lastPurchaseCost' | 'costPrice'>
): CostBasis | null {
  const average = product.averageCost;
  if (typeof average === 'number' && Number.isFinite(average)) {
    return { unitCost: average, source: 'weighted_average' };
  }
  const last = product.lastPurchaseCost;
  if (typeof last === 'number' && Number.isFinite(last)) {
    return { unitCost: last, source: 'last_purchase' };
  }
  const manual = product.costPrice;
  if (typeof manual === 'number' && Number.isFinite(manual)) {
    return { unitCost: manual, source: 'manual' };
  }
  return null;
}

/** Whether a product has any usable cost basis. */
export function hasCostBasis(
  product: Pick<Product, 'averageCost' | 'lastPurchaseCost' | 'costPrice'>
): boolean {
  return costBasis(product) !== null;
}

/** The result of folding a receipt into a product's running average. */
export interface WeightedAverageResult {
  /** The new weighted-average unit cost. */
  averageCost: number;
  /** Stock level after the receipt. */
  stockAfter: number;
  /**
   * True when the previous average was unknown and this receipt established the
   * basis outright (existing on-hand units are adopted at the new cost, because
   * there is no honest alternative — see the note in `applyReceipt`).
   */
  establishedBasis: boolean;
}

/**
 * Fold a received quantity at a known unit cost into a product's running
 * weighted average.
 *
 * @param stockOnHand    Units in stock **before** the receipt.
 * @param currentAverage Current weighted-average cost, or `null` if unknown.
 * @param quantity       Units received (must be > 0).
 * @param unitCost       Cost per unit on this receipt.
 *
 * When `currentAverage` is `null` the existing on-hand units have no recorded
 * cost. Rather than invent one, the receipt's cost becomes the average for the
 * whole on-hand quantity — the standard treatment when opening a cost basis
 * mid-life. `establishedBasis` flags this so the receipt record can say so.
 */
export function applyReceipt(
  stockOnHand: number,
  currentAverage: number | null | undefined,
  quantity: number,
  unitCost: number
): WeightedAverageResult {
  const onHand = Math.max(0, Math.floor(stockOnHand || 0));
  const received = Math.max(0, Math.floor(quantity || 0));
  const cost = Number.isFinite(unitCost) ? Math.max(0, unitCost) : 0;
  const stockAfter = onHand + received;

  if (received === 0) {
    return {
      averageCost: roundMoney(currentAverage ?? cost),
      stockAfter: onHand,
      establishedBasis: false,
    };
  }

  const hasBasis = typeof currentAverage === 'number' && Number.isFinite(currentAverage);
  if (!hasBasis) {
    return { averageCost: roundMoney(cost), stockAfter, establishedBasis: true };
  }

  // Guard the degenerate case of no prior stock: the receipt simply sets the
  // cost, and dividing by `received` alone gives exactly that.
  const priorValue = onHand * (currentAverage as number);
  const receivedValue = received * cost;
  const average = (priorValue + receivedValue) / stockAfter;

  return { averageCost: roundMoney(average), stockAfter, establishedBasis: false };
}

/**
 * Total value of the units a product currently holds, or `null` when the product
 * has no cost basis (which must be reported as unknown, not as zero value).
 */
export function inventoryValue(
  product: Pick<Product, 'stock' | 'averageCost' | 'lastPurchaseCost' | 'costPrice'>
): number | null {
  const basis = costBasis(product);
  if (!basis) return null;
  const units = Math.max(0, product.stock ?? 0);
  return roundMoney(units * basis.unitCost);
}

/** One line's cost, or `null` when the product's cost basis is unknown. */
export function lineCost(
  product: Pick<Product, 'averageCost' | 'lastPurchaseCost' | 'costPrice'>,
  quantity: number
): number | null {
  const basis = costBasis(product);
  if (!basis) return null;
  return roundMoney(basis.unitCost * Math.max(0, quantity));
}

/**
 * Gross margin percentage for a unit, or `null` when cost is unknown or the
 * selling price is zero.
 */
export function marginPercent(sellingPrice: number, unitCost: number | null): number | null {
  if (unitCost === null || !Number.isFinite(sellingPrice) || sellingPrice <= 0) return null;
  return Math.round((((sellingPrice - unitCost) / sellingPrice) * 100 + Number.EPSILON) * 10) / 10;
}
