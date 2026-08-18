/**
 * Inventory calculations — stock states, valuation and turnover.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What `stock` means in BlueBuy
 *
 * Checkout decrements `product.stock` inside the order transaction, at the
 * moment the order is placed. So `stock` is the **available-to-sell** figure —
 * it is already net of orders that haven't shipped yet.
 *
 * That makes two derived numbers worth showing separately:
 *
 *   available   = product.stock                  (what you can still sell)
 *   reserved    = units on open, unshipped orders (physically present, sold)
 *   on hand     = available + reserved            (what's actually on the shelf)
 *
 * Neither `reserved` nor `available` is stored on the product: reserved comes
 * from the orders themselves, so it can never drift out of sync with them.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { Product } from '@/types/models';
import type { Order } from '@/types/order';
import { RESERVING_ORDER_STATUSES } from '@/types/order';
import type { InventoryMovement } from '@/types/business';
import { costBasis, inventoryValue } from './costing';
import { roundMoney, safeDivide } from './metrics';
import type { DateRange } from './date-range';
import { isWithin } from './date-range';

/** Fallback low-stock threshold when a product doesn't set its own. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/**
 * Units per product committed to orders that are placed but not yet shipped.
 * These goods are sold but still physically in the building.
 */
export function reservedUnits(orders: readonly Order[]): Map<string, number> {
  const reserved = new Map<string, number>();
  for (const order of orders) {
    if (!RESERVING_ORDER_STATUSES.includes(order.status)) continue;
    for (const item of order.items) {
      reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + (item.quantity || 0));
    }
  }
  return reserved;
}

/** How a product's stock level reads at a glance. */
export type StockState = 'out_of_stock' | 'low' | 'healthy' | 'overstock';

/** Per-product inventory position. */
export interface InventoryPosition {
  productId: string;
  title: string;
  slug: string;
  /** Available to sell (the stored `stock`). */
  available: number;
  /** Sold but not yet shipped. */
  reserved: number;
  /** available + reserved. */
  onHand: number;
  state: StockState;
  /** Threshold in effect for this product. */
  lowStockThreshold: number;
  reorderLevel: number;
  /** Unit cost basis, or `null` when unknown. */
  unitCost: number | null;
  /** available × unit cost, or `null` when cost is unknown. */
  value: number | null;
  /** True when the product has no cost basis at all. */
  costUnknown: boolean;
}

/** Options controlling how stock states are classified. */
export interface InventoryOptions {
  /** Global low-stock threshold; a product's own value wins when set. */
  lowStockThreshold?: number;
  /**
   * Multiple of the reorder level above which stock counts as overstock.
   * Only applied to products that actually define a reorder level — without one
   * there is no basis for calling stock "too much", so nothing is flagged.
   */
  overstockMultiple?: number;
}

/** Classify one product's stock position. */
export function positionFor(
  product: Product,
  reserved: number,
  options: InventoryOptions = {}
): InventoryPosition {
  const globalThreshold = options.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  const overstockMultiple = options.overstockMultiple ?? 3;

  const available = Math.max(0, product.stock ?? 0);
  const threshold =
    typeof product.lowStockThreshold === 'number' && product.lowStockThreshold > 0
      ? product.lowStockThreshold
      : globalThreshold;
  const reorderLevel = product.reorderLevel ?? 0;

  let state: StockState;
  if (available <= 0) {
    state = 'out_of_stock';
  } else if (available <= threshold) {
    state = 'low';
  } else if (reorderLevel > 0 && available >= reorderLevel * overstockMultiple) {
    state = 'overstock';
  } else {
    state = 'healthy';
  }

  const basis = costBasis(product);

  return {
    productId: product.id,
    title: product.title,
    slug: product.slug,
    available,
    reserved,
    onHand: available + reserved,
    state,
    lowStockThreshold: threshold,
    reorderLevel,
    unitCost: basis?.unitCost ?? null,
    value: inventoryValue(product),
    costUnknown: basis === null,
  };
}

/** Inventory positions for the whole catalogue. */
export function inventoryPositions(
  products: readonly Product[],
  orders: readonly Order[],
  options: InventoryOptions = {}
): InventoryPosition[] {
  const reserved = reservedUnits(orders);
  return products.map((product) => positionFor(product, reserved.get(product.id) ?? 0, options));
}

/** Catalogue-wide inventory summary. */
export interface InventorySummary {
  productCount: number;
  /** Σ available units. */
  totalUnits: number;
  /** Σ units on open orders. */
  reservedUnits: number;
  /** Σ available + reserved. */
  onHandUnits: number;
  /**
   * Σ value of products that have a cost basis. Products without one are
   * excluded and counted in `unvaluedProducts` — never valued at zero.
   */
  totalValue: number;
  valuedProducts: number;
  /** Products with stock but no cost basis; their value is unknown. */
  unvaluedProducts: number;
  /** True when every stocked product has a cost basis. */
  valuationComplete: boolean;
  lowStockCount: number;
  outOfStockCount: number;
  overstockCount: number;
  /** Products at or below their reorder level (and with one set). */
  reorderCount: number;
}

export function inventorySummary(positions: readonly InventoryPosition[]): InventorySummary {
  let totalUnits = 0;
  let reserved = 0;
  let totalValue = 0;
  let valued = 0;
  let unvalued = 0;
  let low = 0;
  let out = 0;
  let over = 0;
  let reorder = 0;

  for (const position of positions) {
    totalUnits += position.available;
    reserved += position.reserved;

    if (position.value === null) {
      // Only count it as a valuation gap when there is stock to value.
      if (position.available > 0) unvalued += 1;
    } else {
      totalValue += position.value;
      valued += 1;
    }

    if (position.state === 'low') low += 1;
    if (position.state === 'out_of_stock') out += 1;
    if (position.state === 'overstock') over += 1;
    if (position.reorderLevel > 0 && position.available <= position.reorderLevel) reorder += 1;
  }

  return {
    productCount: positions.length,
    totalUnits,
    reservedUnits: reserved,
    onHandUnits: totalUnits + reserved,
    totalValue: roundMoney(totalValue),
    valuedProducts: valued,
    unvaluedProducts: unvalued,
    valuationComplete: unvalued === 0,
    lowStockCount: low,
    outOfStockCount: out,
    overstockCount: over,
    reorderCount: reorder,
  };
}

// ─────────────────────────────── Turnover ────────────────────────────────────

/**
 * Inventory turnover = COGS ÷ average inventory value.
 *
 * Returns `null` when it cannot be computed honestly — no COGS captured, or no
 * average inventory value. A turnover of "0.0" on a store with no cost data
 * would look like a real (terrible) number, so we refuse to print one.
 */
export function inventoryTurnover(
  cogs: number,
  averageInventoryValue: number | null
): number | null {
  if (averageInventoryValue === null || averageInventoryValue <= 0) return null;
  if (!Number.isFinite(cogs) || cogs <= 0) return null;
  const ratio = safeDivide(cogs, averageInventoryValue);
  return ratio === null ? null : Math.round((ratio + Number.EPSILON) * 100) / 100;
}

/**
 * Reconstruct stock as it stood at the start of a range, by unwinding the
 * movements recorded during it.
 *
 * This is what makes an *average* inventory value (and therefore turnover)
 * computable without storing daily snapshots. It is only as complete as the
 * movement ledger: movements written before the ledger existed aren't there, so
 * callers should treat the result as an estimate and say so.
 */
export function openingUnits(
  products: readonly Product[],
  movements: readonly InventoryMovement[],
  range: DateRange
): Map<string, number> {
  const opening = new Map<string, number>();
  for (const product of products) {
    opening.set(product.id, Math.max(0, product.stock ?? 0));
  }

  // Movements after the range's start are unwound to recover the opening level.
  for (const movement of movements) {
    if (!isWithin(movement.occurredAt, range)) continue;
    const current = opening.get(movement.productId);
    if (current === undefined) continue;
    opening.set(movement.productId, current - (movement.quantityChange || 0));
  }

  for (const [id, units] of opening) {
    opening.set(id, Math.max(0, units));
  }
  return opening;
}

/**
 * Average inventory value across a range, using reconstructed opening stock and
 * current closing stock, both valued at today's cost basis.
 *
 * Returns `null` when no product has a cost basis. The valuation uses current
 * unit costs on both ends — a documented approximation, since BlueBuy does not
 * snapshot historical cost per day.
 */
export function averageInventoryValue(
  products: readonly Product[],
  movements: readonly InventoryMovement[],
  range: DateRange
): number | null {
  const opening = openingUnits(products, movements, range);

  let openingValue = 0;
  let closingValue = 0;
  let anyCost = false;

  for (const product of products) {
    const basis = costBasis(product);
    if (!basis) continue;
    anyCost = true;
    openingValue += (opening.get(product.id) ?? 0) * basis.unitCost;
    closingValue += Math.max(0, product.stock ?? 0) * basis.unitCost;
  }

  if (!anyCost) return null;
  return roundMoney((openingValue + closingValue) / 2);
}

// ──────────────────────────── Movement helpers ───────────────────────────────

/** Net stock change a set of movements represents, per product. */
export function netChangeByProduct(movements: readonly InventoryMovement[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const movement of movements) {
    net.set(
      movement.productId,
      (net.get(movement.productId) ?? 0) + (movement.quantityChange || 0)
    );
  }
  return net;
}

/** Movements grouped by type, for the inventory activity summary. */
export function movementsByType(
  movements: readonly InventoryMovement[]
): { type: string; count: number; units: number }[] {
  const groups = new Map<string, { count: number; units: number }>();
  for (const movement of movements) {
    const entry = groups.get(movement.type) ?? { count: 0, units: 0 };
    entry.count += 1;
    entry.units += Math.abs(movement.quantityChange || 0);
    groups.set(movement.type, entry);
  }
  return [...groups.entries()]
    .map(([type, entry]) => ({ type, ...entry }))
    .sort((a, b) => b.units - a.units);
}

/**
 * Products whose recorded movements don't reconcile to their current stock.
 *
 * Only meaningful once the ledger covers a product's whole life; a product that
 * existed before the ledger will legitimately differ by its opening balance.
 * Surfacing drift is the point — it should be corrected with an explicit
 * `correction` movement, never silently patched.
 */
export function reconciliationDrift(
  products: readonly Product[],
  movements: readonly InventoryMovement[]
): { productId: string; title: string; expected: number; actual: number; drift: number }[] {
  const net = netChangeByProduct(movements);
  const drifts: {
    productId: string;
    title: string;
    expected: number;
    actual: number;
    drift: number;
  }[] = [];

  for (const product of products) {
    const expected = net.get(product.id);
    if (expected === undefined) continue;
    const actual = Math.max(0, product.stock ?? 0);
    if (expected === actual) continue;
    drifts.push({
      productId: product.id,
      title: product.title,
      expected,
      actual,
      drift: actual - expected,
    });
  }
  return drifts;
}
