/**
 * Product / category / brand performance.
 *
 * The join between views, sales and stock is where "most viewed but rarely
 * bought" and "dead stock" come from, so the tests pin both the arithmetic and
 * the conservatism: a label is only applied when the data actually supports it.
 */
import { describe, expect, it } from 'vitest';
import type { Product } from '@/types/models';
import type { Order, OrderItem } from '@/types/order';
import type { AnalyticsEvent, AnalyticsEventType } from '@/types/business';
import { groupPerformance, performanceInsights, productPerformance } from './performance';

const NOW = new Date(2026, 7, 18);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Product 1',
    slug: 'product-1',
    categoryId: 'c1',
    brandId: 'b1',
    stock: 10,
    averageCost: null,
    lastPurchaseCost: null,
    costPrice: null,
    ...overrides,
  } as Product;
}

function order(items: Partial<OrderItem>[], costPerUnit: number | null = null, id = 'o1'): Order {
  const lines = items.map((item) => {
    const quantity = item.quantity ?? 1;
    const unitPrice = item.unitPrice ?? 100;
    return {
      productId: item.productId ?? 'p1',
      slug: 'x',
      title: item.title ?? 'Product 1',
      accent: '#000',
      unitPrice,
      quantity,
      lineTotal: unitPrice * quantity,
    };
  });

  const base: Order = {
    id,
    orderId: id,
    customer: { fullName: 'A', phone: '1234567', city: 'X', address: 'Y' },
    items: lines,
    subtotal: lines.reduce((s, l) => s + l.lineTotal, 0),
    shipping: 0,
    discount: 0,
    total: lines.reduce((s, l) => s + l.lineTotal, 0),
    currency: 'USD',
    status: 'delivered',
    createdAt: NOW,
    updatedAt: NOW,
  };

  if (costPerUnit === null) return base;

  const costLines = lines.map((l) => ({
    productId: l.productId,
    title: l.title,
    quantity: l.quantity,
    unitCost: costPerUnit,
    lineCost: costPerUnit * l.quantity,
  }));
  return {
    ...base,
    costing: {
      method: 'weighted_average',
      lines: costLines,
      totalCost: costLines.reduce((s, l) => s + l.lineCost, 0),
      complete: true,
      capturedAt: NOW,
      capturedBy: { uid: 'u', email: null, label: 'u' },
    },
  };
}

let n = 0;
function event(type: AnalyticsEventType, productId: string, sessionId = 's1'): AnalyticsEvent {
  n += 1;
  return {
    id: `e${n}`,
    type,
    sessionId,
    dayKey: '2026-08-18',
    path: '/',
    productId,
    productTitle: '',
    categoryId: '',
    brandId: '',
    searchTerm: '',
    resultCount: null,
    quantity: null,
    value: null,
    occurredAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** `count` views of a product, each from a distinct session. */
function views(productId: string, count: number): AnalyticsEvent[] {
  return Array.from({ length: count }, (_, i) => event('product_view', productId, `s${i}`));
}

describe('productPerformance', () => {
  it('joins views, sales, cost and stock into one row', () => {
    const rows = productPerformance(
      [product({ stock: 6, averageCost: 40 })],
      [order([{ quantity: 2, unitPrice: 100 }], 40)],
      views('p1', 50)
    );

    expect(rows[0]).toMatchObject({
      productId: 'p1',
      views: 50,
      units: 2,
      revenue: 200,
      cost: 80,
      grossProfit: 120,
      marginPercent: 60,
      stock: 6,
      unitCost: 40,
      inventoryValue: 240,
    });
  });

  it('includes products with no views and no sales', () => {
    // A product nobody has seen is a finding, not a row to drop.
    const rows = productPerformance([product({ id: 'ghost' })], [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ views: 0, units: 0, revenue: 0 });
  });

  it('leaves money null when no cost was ever captured', () => {
    const rows = productPerformance([product()], [order([{ quantity: 1 }])], []);
    expect(rows[0].cost).toBeNull();
    expect(rows[0].grossProfit).toBeNull();
    expect(rows[0].inventoryValue).toBeNull();
  });

  it('withholds a conversion rate on too few views', () => {
    const thin = productPerformance([product()], [order([{ quantity: 1 }])], views('p1', 5));
    expect(thin[0].conversionRate).toBeNull();

    const solid = productPerformance([product()], [order([{ quantity: 10 }])], views('p1', 100));
    expect(solid[0].conversionRate).toBe(10);
  });
});

describe('performanceInsights', () => {
  it('separates best sellers from most profitable', () => {
    // High revenue at thin margin vs. lower revenue at fat margin.
    const rows = productPerformance(
      [product({ id: 'volume' }), product({ id: 'margin' })],
      [
        order([{ productId: 'volume', quantity: 10, unitPrice: 100 }], 95, 'a'),
        order([{ productId: 'margin', quantity: 2, unitPrice: 200 }], 20, 'b'),
      ],
      []
    );
    const insights = performanceInsights(rows);

    expect(insights.bestSellers[0].productId).toBe('volume');
    expect(insights.mostProfitable[0].productId).toBe('margin');
  });

  it('flags heavily viewed products that never sell', () => {
    const rows = productPerformance([product()], [], views('p1', 40));
    expect(performanceInsights(rows).viewedNotBought[0]?.productId).toBe('p1');
  });

  it('does not flag a product viewed only a handful of times', () => {
    // Three views and no sale is not evidence of a problem.
    const rows = productPerformance([product()], [], views('p1', 3));
    expect(performanceInsights(rows).viewedNotBought).toHaveLength(0);
  });

  it('lists low-stock best sellers as the reorder priority', () => {
    const rows = productPerformance(
      [product({ stock: 2, averageCost: 10 })],
      [order([{ quantity: 25 }], 10)],
      []
    );
    expect(
      performanceInsights(rows, { lowStockThreshold: 5 }).lowStockBestSellers[0].productId
    ).toBe('p1');
  });

  it('identifies dead stock and unseen products distinctly', () => {
    const rows = productPerformance(
      [product({ id: 'sitting', stock: 40, averageCost: 5 }), product({ id: 'empty', stock: 0 })],
      [],
      []
    );
    const insights = performanceInsights(rows);

    // Dead stock needs stock actually sitting there.
    expect(insights.deadStock.map((r) => r.productId)).toEqual(['sitting']);
    // Both have no views at all.
    expect(insights.noViews.map((r) => r.productId).sort()).toEqual(['empty', 'sitting']);
  });
});

describe('groupPerformance', () => {
  it('rolls products up by category with combined money', () => {
    const rows = productPerformance(
      [product({ id: 'a', categoryId: 'c1' }), product({ id: 'b', categoryId: 'c1' })],
      [
        order([{ productId: 'a', quantity: 1, unitPrice: 100 }], 60, 'o1'),
        order([{ productId: 'b', quantity: 1, unitPrice: 100 }], 40, 'o2'),
      ],
      []
    );
    const groups = groupPerformance(rows, (row) => row.categoryId, new Map([['c1', 'Jewellery']]));

    expect(groups[0]).toMatchObject({
      label: 'Jewellery',
      products: 2,
      revenue: 200,
      cost: 100,
      grossProfit: 100,
      marginPercent: 50,
    });
  });

  it('reports unknown margin when no product in the group has a cost', () => {
    const rows = productPerformance(
      [product({ categoryId: 'c1' })],
      [order([{ quantity: 1, unitPrice: 100 }])],
      []
    );
    const groups = groupPerformance(rows, (row) => row.categoryId, new Map([['c1', 'Jewellery']]));

    expect(groups[0].cost).toBeNull();
    expect(groups[0].marginPercent).toBeNull();
  });
});
