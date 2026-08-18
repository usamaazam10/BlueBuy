/**
 * Sales, COGS coverage and profit.
 *
 * The behaviours worth protecting here are the exclusions and the `null`s:
 * cancelled/returned orders must not count as revenue, and profit must refuse
 * to print a number when the cost side is unknown.
 */
import { describe, expect, it } from 'vitest';
import type { Order, OrderItem, OrderStatus } from '@/types/order';
import type { Expense } from '@/types/business';
import { cogsSummary, decliningProducts, salesByProduct, salesMetrics, salesSeries } from './sales';
import { profitAndLoss, expenseBreakdown } from './profit';
import { resolveDateRange } from './date-range';

const NOW = new Date(2026, 7, 18, 12, 0, 0);

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  const quantity = overrides.quantity ?? 1;
  const unitPrice = overrides.unitPrice ?? 100;
  return {
    productId: 'p1',
    slug: 'p1',
    title: 'Product 1',
    accent: '#000',
    unitPrice,
    quantity,
    lineTotal: unitPrice * quantity,
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  const items = overrides.items ?? [item()];
  const subtotal = overrides.subtotal ?? items.reduce((s, i) => s + i.lineTotal, 0);
  const shipping = overrides.shipping ?? 0;
  const discount = overrides.discount ?? 0;
  return {
    id: 'BB-1',
    orderId: 'BB-1',
    customer: { fullName: 'A', phone: '123456789', city: 'X', address: 'Y' },
    items,
    subtotal,
    shipping,
    discount,
    total: subtotal - discount + shipping,
    currency: 'USD',
    status: 'confirmed' as OrderStatus,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** An order with a captured cost snapshot. */
function costedOrder(unitCost: number, overrides: Partial<Order> = {}): Order {
  const base = order(overrides);
  const lines = base.items.map((line) => ({
    productId: line.productId,
    title: line.title,
    quantity: line.quantity,
    unitCost,
    lineCost: unitCost * line.quantity,
  }));
  return {
    ...base,
    costing: {
      method: 'weighted_average',
      lines,
      totalCost: lines.reduce((s, l) => s + l.lineCost, 0),
      complete: true,
      capturedAt: NOW,
      capturedBy: { uid: 'u1', email: 'a@b.c', label: 'a@b.c' },
    },
  };
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    amount: 100,
    currency: 'USD',
    categoryId: 'c1',
    categoryName: 'Advertising',
    isInventoryProcurement: false,
    incurredAt: NOW,
    paymentMethod: 'cash',
    description: '',
    reference: '',
    attachmentUrl: null,
    createdBy: { uid: 'u1', email: null, label: 'u1' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('salesMetrics', () => {
  it('separates gross sales, discounts, shipping and net sales', () => {
    const metrics = salesMetrics([order({ subtotal: 1000, discount: 100, shipping: 50 })]);
    expect(metrics.grossSales).toBe(1000);
    expect(metrics.discounts).toBe(100);
    // Shipping is not product revenue and stays out of net sales.
    expect(metrics.netSales).toBe(900);
    expect(metrics.shippingRevenue).toBe(50);
    // Order value is what the customer was actually billed.
    expect(metrics.orderValue).toBe(950);
  });

  it('excludes cancelled and returned orders from every figure', () => {
    const metrics = salesMetrics([
      order({ id: 'a', subtotal: 100 }),
      order({ id: 'b', subtotal: 999, status: 'cancelled' }),
      order({ id: 'c', subtotal: 999, status: 'returned' }),
    ]);
    expect(metrics.grossSales).toBe(100);
    expect(metrics.orderCount).toBe(1);
    expect(metrics.excludedOrderCount).toBe(2);
  });

  it('subtracts refunds from net sales and order value', () => {
    const metrics = salesMetrics([order({ subtotal: 500, refundedAmount: 200 })]);
    expect(metrics.netSales).toBe(300);
    expect(metrics.orderValue).toBe(300);
  });

  it('returns a null average order value rather than dividing by zero', () => {
    expect(salesMetrics([]).averageOrderValue).toBeNull();
  });

  it('counts units across lines', () => {
    const metrics = salesMetrics([
      order({ items: [item({ quantity: 2 }), item({ productId: 'p2', quantity: 3 })] }),
    ]);
    expect(metrics.unitsSold).toBe(5);
  });
});

describe('cogsSummary', () => {
  it('reports full coverage when every order is costed', () => {
    const summary = cogsSummary([costedOrder(60), costedOrder(60)]);
    expect(summary.total).toBe(120);
    expect(summary.complete).toBe(true);
    expect(summary.coveragePercent).toBe(100);
  });

  it('flags uncosted orders instead of assuming zero cost', () => {
    const summary = cogsSummary([costedOrder(60), order({ id: 'b' })]);
    expect(summary.total).toBe(60);
    expect(summary.uncostedOrders).toBe(1);
    expect(summary.complete).toBe(false);
    expect(summary.coveragePercent).toBe(50);
  });

  it('ignores cancelled orders when measuring coverage', () => {
    const summary = cogsSummary([costedOrder(60), order({ id: 'b', status: 'cancelled' })]);
    expect(summary.complete).toBe(true);
  });
});

describe('profitAndLoss', () => {
  it('computes gross and operating profit from real cost data', () => {
    const pl = profitAndLoss([costedOrder(60, { subtotal: 100 })], [expense({ amount: 10 })]);
    expect(pl.sales.netSales).toBe(100);
    expect(pl.cogs.total).toBe(60);
    expect(pl.grossProfit).toBe(40);
    expect(pl.grossMarginPercent).toBe(40);
    expect(pl.operatingProfit).toBe(30);
    expect(pl.dataQuality).toBe('complete');
  });

  it('refuses to report profit when no cost data exists', () => {
    const pl = profitAndLoss([order({ subtotal: 100 })], []);
    expect(pl.grossProfit).toBeNull();
    expect(pl.operatingProfit).toBeNull();
    expect(pl.dataQuality).toBe('unavailable');
    expect(pl.dataNote).toBeTruthy();
  });

  it('marks profit partial when only some orders are costed', () => {
    const pl = profitAndLoss([costedOrder(60), order({ id: 'b' })], []);
    expect(pl.dataQuality).toBe('partial');
    // A number is still offered, but the caller is told it understates cost.
    expect(pl.grossProfit).not.toBeNull();
  });

  it('treats a period with no sales as complete, not as missing data', () => {
    const pl = profitAndLoss([], []);
    expect(pl.dataQuality).toBe('complete');
    expect(pl.grossProfit).toBe(0);
  });

  it('keeps inventory purchases out of operating expenses', () => {
    // Stock bought this month becomes COGS when it sells, not an expense now.
    // Counting it here would double-charge the P&L.
    const pl = profitAndLoss(
      [costedOrder(60, { subtotal: 100 })],
      [expense({ amount: 10 }), expense({ id: 'e2', amount: 5000, isInventoryProcurement: true })]
    );
    expect(pl.expenses.operating).toBe(10);
    expect(pl.expenses.inventoryProcurement).toBe(5000);
    expect(pl.operatingProfit).toBe(30);
  });
});

describe('expenseBreakdown', () => {
  it('groups by category and totals both buckets', () => {
    const split = expenseBreakdown([
      expense({ amount: 30 }),
      expense({ id: 'e2', amount: 20 }),
      expense({ id: 'e3', amount: 100, categoryId: 'c2', categoryName: 'Rent' }),
    ]);
    expect(split.operating).toBe(150);
    expect(split.byCategory[0]).toMatchObject({ categoryName: 'Rent', amount: 100 });
    expect(split.byCategory[1]).toMatchObject({ categoryName: 'Advertising', amount: 50 });
  });
});

describe('salesByProduct', () => {
  it('aggregates revenue, units and per-line cost from the snapshot', () => {
    const rows = salesByProduct([costedOrder(60, { items: [item({ quantity: 2 })] })]);
    expect(rows[0]).toMatchObject({
      key: 'p1',
      revenue: 200,
      units: 2,
      cost: 120,
      grossProfit: 80,
      marginPercent: 40,
    });
  });

  it('leaves cost null when the order was never costed', () => {
    const rows = salesByProduct([order()]);
    expect(rows[0].cost).toBeNull();
    expect(rows[0].grossProfit).toBeNull();
  });
});

describe('salesSeries', () => {
  it('emits every day in the range, including zero days', () => {
    const range = resolveDateRange('last_7_days', null, NOW);
    const series = salesSeries([order({ createdAt: NOW, subtotal: 100 })], range);
    expect(series).toHaveLength(7);
    expect(series.at(-1)).toMatchObject({ dayKey: '2026-08-18', netSales: 100, orders: 1 });
    expect(series[0].netSales).toBe(0);
  });
});

describe('decliningProducts', () => {
  it('reports only products that actually existed before', () => {
    const previous = [costedOrder(10, { id: 'old', items: [item({ quantity: 10 })] })];
    const current = [costedOrder(10, { id: 'new', items: [item({ quantity: 2 })] })];
    const declines = decliningProducts(current, previous);
    expect(declines).toHaveLength(1);
    expect(declines[0]).toMatchObject({ key: 'p1', changePercent: -80 });
  });

  it('does not call a brand-new product a decline', () => {
    const current = [costedOrder(10, { items: [item({ productId: 'fresh' })] })];
    expect(decliningProducts(current, [])).toHaveLength(0);
  });
});
