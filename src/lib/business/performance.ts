/**
 * Product performance — the join between what customers *looked at* and what
 * they *bought*.
 *
 * This is the only module that combines the three data sources: analytics events
 * (views, cart adds), orders (units, revenue, captured cost) and the catalogue
 * (stock, cost basis). Keeping the join here means the product, category and
 * brand reports all rank on identical definitions.
 *
 * Every derived rate is `null` when it cannot be stated honestly — a product
 * with four views has no meaningful conversion rate, and a product with no
 * captured cost has no meaningful margin.
 */
import type { Product } from '@/types/models';
import type { Order } from '@/types/order';
import type { AnalyticsEvent } from '@/types/business';
import { productConversionRate, productEngagement } from './analytics';
import { costBasis } from './costing';
import { salesByProduct } from './sales';
import { percentOf, roundMoney } from './metrics';

/** One product's full performance picture for a period. */
export interface ProductPerformance {
  productId: string;
  title: string;
  slug: string;
  categoryId: string;
  brandId: string;

  // Engagement
  views: number;
  viewSessions: number;
  addToCarts: number;

  // Sales
  orders: number;
  units: number;
  revenue: number;

  // Money — `null` when the cost basis is unknown
  cost: number | null;
  grossProfit: number | null;
  marginPercent: number | null;

  // Stock
  stock: number;
  unitCost: number | null;
  inventoryValue: number | null;

  /** Units sold ÷ views, or `null` on too few views. */
  conversionRate: number | null;
  /** Cart adds ÷ views, or `null` on too few views. */
  addToCartRate: number | null;
}

/**
 * Build the performance table.
 *
 * Every catalogue product appears, including ones with no views and no sales —
 * a product nobody has seen is a finding, not a row to omit.
 */
export function productPerformance(
  products: readonly Product[],
  orders: readonly Order[],
  events: readonly AnalyticsEvent[]
): ProductPerformance[] {
  const engagement = productEngagement(events);
  const sales = new Map(salesByProduct(orders).map((row) => [row.key, row]));

  return products.map((product) => {
    const view = engagement.get(product.id);
    const sold = sales.get(product.id);
    const basis = costBasis(product);

    const views = view?.views ?? 0;
    const units = sold?.units ?? 0;
    const stock = Math.max(0, product.stock ?? 0);

    return {
      productId: product.id,
      title: product.title,
      slug: product.slug,
      categoryId: product.categoryId,
      brandId: product.brandId,

      views,
      viewSessions: view?.viewSessions ?? 0,
      addToCarts: view?.addToCarts ?? 0,

      orders: sold?.orders ?? 0,
      units,
      revenue: sold?.revenue ?? 0,

      cost: sold?.cost ?? null,
      grossProfit: sold?.grossProfit ?? null,
      marginPercent: sold?.marginPercent ?? null,

      stock,
      unitCost: basis?.unitCost ?? null,
      inventoryValue: basis ? roundMoney(stock * basis.unitCost) : null,

      conversionRate: productConversionRate(views, units),
      addToCartRate: views === 0 ? null : productConversionRate(views, view?.addToCarts ?? 0),
    };
  });
}

/**
 * Named findings the owner should act on.
 *
 * Each list is deliberately conservative: a product only appears when the data
 * genuinely supports the label. "Most viewed, rarely bought" needs enough views
 * to rule out coincidence; "dead stock" needs stock actually sitting there.
 */
export interface PerformanceInsights {
  /** Highest revenue. */
  bestSellers: ProductPerformance[];
  /** Highest gross profit — not the same list as best sellers. */
  mostProfitable: ProductPerformance[];
  /** Highest margin percentage, among products with known cost. */
  highestMargin: ProductPerformance[];
  /** Plenty of interest, almost no sales — a pricing or listing problem. */
  viewedNotBought: ProductPerformance[];
  /** Selling well and nearly out of stock — the most urgent reorder list. */
  lowStockBestSellers: ProductPerformance[];
  /** Stock sitting with no sales at all in the period. */
  deadStock: ProductPerformance[];
  /** In the catalogue but nobody has looked at it — a discoverability problem. */
  noViews: ProductPerformance[];
}

/** Views below which "viewed but not bought" would be reading into noise. */
const MIN_VIEWS_FOR_INTEREST = 20;

export function performanceInsights(
  rows: readonly ProductPerformance[],
  options: { lowStockThreshold?: number; limit?: number } = {}
): PerformanceInsights {
  const lowStockThreshold = options.lowStockThreshold ?? 5;
  const limit = options.limit ?? 8;

  const byRevenue = [...rows]
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const byProfit = [...rows]
    .filter((row) => row.grossProfit !== null)
    .sort((a, b) => (b.grossProfit ?? 0) - (a.grossProfit ?? 0));

  const byMargin = [...rows]
    .filter((row) => row.marginPercent !== null && row.units > 0)
    .sort((a, b) => (b.marginPercent ?? 0) - (a.marginPercent ?? 0));

  const viewedNotBought = [...rows]
    .filter((row) => row.views >= MIN_VIEWS_FOR_INTEREST && row.units === 0)
    .sort((a, b) => b.views - a.views);

  const lowStockBestSellers = [...rows]
    .filter((row) => row.units > 0 && row.stock > 0 && row.stock <= lowStockThreshold)
    .sort((a, b) => b.units - a.units);

  const deadStock = [...rows]
    .filter((row) => row.stock > 0 && row.units === 0)
    .sort((a, b) => (b.inventoryValue ?? 0) - (a.inventoryValue ?? 0));

  const noViews = [...rows].filter((row) => row.views === 0 && row.units === 0);

  return {
    bestSellers: byRevenue.slice(0, limit),
    mostProfitable: byProfit.slice(0, limit),
    highestMargin: byMargin.slice(0, limit),
    viewedNotBought: viewedNotBought.slice(0, limit),
    lowStockBestSellers: lowStockBestSellers.slice(0, limit),
    deadStock: deadStock.slice(0, limit),
    noViews: noViews.slice(0, limit),
  };
}

/** A category or brand rollup of the same metrics. */
export interface GroupPerformance {
  key: string;
  label: string;
  products: number;
  views: number;
  units: number;
  orders: number;
  revenue: number;
  cost: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
  inventoryValue: number | null;
  conversionRate: number | null;
}

/**
 * Roll product performance up by category or brand.
 *
 * A group's cost is `null` unless at least one of its products had a known cost,
 * so a category of never-costed products reports unknown margin rather than a
 * flattering 100%.
 */
export function groupPerformance(
  rows: readonly ProductPerformance[],
  keyOf: (row: ProductPerformance) => string,
  labels: ReadonlyMap<string, string>
): GroupPerformance[] {
  const groups = new Map<
    string,
    {
      products: number;
      views: number;
      units: number;
      orders: number;
      revenue: number;
      cost: number;
      costKnown: boolean;
      inventoryValue: number;
      valueKnown: boolean;
    }
  >();

  for (const row of rows) {
    const key = keyOf(row) || '__unknown__';
    const entry = groups.get(key) ?? {
      products: 0,
      views: 0,
      units: 0,
      orders: 0,
      revenue: 0,
      cost: 0,
      costKnown: false,
      inventoryValue: 0,
      valueKnown: false,
    };

    entry.products += 1;
    entry.views += row.views;
    entry.units += row.units;
    entry.orders += row.orders;
    entry.revenue += row.revenue;

    if (row.cost !== null) {
      entry.cost += row.cost;
      entry.costKnown = true;
    }
    if (row.inventoryValue !== null) {
      entry.inventoryValue += row.inventoryValue;
      entry.valueKnown = true;
    }

    groups.set(key, entry);
  }

  return [...groups.entries()]
    .map(([key, entry]) => {
      const revenue = roundMoney(entry.revenue);
      const cost = entry.costKnown ? roundMoney(entry.cost) : null;
      const grossProfit = cost === null ? null : roundMoney(revenue - cost);

      return {
        key,
        label: labels.get(key) ?? 'Unknown',
        products: entry.products,
        views: entry.views,
        units: entry.units,
        orders: entry.orders,
        revenue,
        cost,
        grossProfit,
        marginPercent: grossProfit === null ? null : percentOf(grossProfit, revenue),
        inventoryValue: entry.valueKnown ? roundMoney(entry.inventoryValue) : null,
        conversionRate: productConversionRate(entry.views, entry.units),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}
