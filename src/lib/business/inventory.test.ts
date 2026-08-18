/**
 * Inventory positions, valuation and cash flow.
 *
 * Two invariants matter most: stock with no cost basis is never valued at zero,
 * and cash flow is computed from the money ledger — never inferred from orders.
 */
import { describe, expect, it } from 'vitest';
import type { Product } from '@/types/models';
import type { Order, OrderStatus } from '@/types/order';
import type { CashTransaction, InventoryMovement } from '@/types/business';
import {
  inventoryPositions,
  inventorySummary,
  inventoryTurnover,
  openingUnits,
  reconciliationDrift,
  reservedUnits,
} from './inventory';
import { balanceBefore, cashFlowSummary, cashSeries } from './cashflow';
import { compare, percentOf, roundMoney, safeDivide } from './metrics';
import { escapeCsvValue, toCsv } from './csv';
import { resolveDateRange } from './date-range';

const NOW = new Date(2026, 7, 18, 12, 0, 0);

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Product 1',
    slug: 'product-1',
    stock: 10,
    averageCost: null,
    lastPurchaseCost: null,
    costPrice: null,
    reorderLevel: 0,
    lowStockThreshold: null,
    ...overrides,
  } as Product;
}

function order(status: OrderStatus, productId: string, quantity: number, id = 'o1'): Order {
  return {
    id,
    orderId: id,
    customer: { fullName: 'A', phone: '1234567', city: 'X', address: 'Y' },
    items: [
      {
        productId,
        slug: productId,
        title: productId,
        accent: '#000',
        unitPrice: 10,
        quantity,
        lineTotal: 10 * quantity,
      },
    ],
    subtotal: 10 * quantity,
    shipping: 0,
    discount: 0,
    total: 10 * quantity,
    currency: 'USD',
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function movement(overrides: Partial<InventoryMovement> = {}): InventoryMovement {
  return {
    id: 'm1',
    productId: 'p1',
    productTitle: 'Product 1',
    productSlug: 'product-1',
    type: 'purchase_received',
    quantityChange: 10,
    stockAfter: 10,
    unitCost: null,
    totalValue: null,
    reference: { kind: 'manual', id: '', label: '' },
    reason: '',
    notes: '',
    createdBy: { uid: null, email: null, label: 'test' },
    occurredAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function cash(overrides: Partial<CashTransaction> = {}): CashTransaction {
  return {
    id: 't1',
    direction: 'inflow',
    amount: 100,
    currency: 'USD',
    source: 'sale',
    category: 'Customer payment',
    description: '',
    occurredAt: NOW,
    paymentMethod: 'cash',
    reference: { kind: 'manual', id: '', label: '' },
    createdBy: { uid: null, email: null, label: 'test' },
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('reservedUnits', () => {
  it('counts units on open orders only', () => {
    const reserved = reservedUnits([
      order('pending', 'p1', 2, 'a'),
      order('packed', 'p1', 3, 'b'),
      // Shipped goods have left the building; delivered/cancelled aren't held.
      order('shipped', 'p1', 5, 'c'),
      order('cancelled', 'p1', 7, 'd'),
    ]);
    expect(reserved.get('p1')).toBe(5);
  });
});

describe('inventory positions', () => {
  it('classifies out-of-stock, low and healthy levels', () => {
    const positions = inventoryPositions(
      [
        product({ id: 'a', stock: 0 }),
        product({ id: 'b', stock: 3 }),
        product({ id: 'c', stock: 50 }),
      ],
      [],
      { lowStockThreshold: 5 }
    );
    expect(positions.map((p) => p.state)).toEqual(['out_of_stock', 'low', 'healthy']);
  });

  it('lets a product override the global low-stock threshold', () => {
    const [position] = inventoryPositions([product({ stock: 8, lowStockThreshold: 10 })], [], {
      lowStockThreshold: 5,
    });
    expect(position.state).toBe('low');
  });

  it('only flags overstock when a reorder level is set', () => {
    const [noLevel] = inventoryPositions([product({ stock: 1000 })], []);
    expect(noLevel.state).toBe('healthy');

    const [withLevel] = inventoryPositions([product({ stock: 1000, reorderLevel: 10 })], []);
    expect(withLevel.state).toBe('overstock');
  });

  it('treats stock as available and adds reserved units for on-hand', () => {
    const [position] = inventoryPositions([product({ stock: 10 })], [order('pending', 'p1', 4)]);
    expect(position.available).toBe(10);
    expect(position.reserved).toBe(4);
    expect(position.onHand).toBe(14);
  });
});

describe('inventorySummary', () => {
  it('excludes products with no cost basis from the valuation and counts them', () => {
    const positions = inventoryPositions(
      [product({ id: 'a', stock: 4, averageCost: 25 }), product({ id: 'b', stock: 10 })],
      []
    );
    const summary = inventorySummary(positions);
    expect(summary.totalValue).toBe(100);
    expect(summary.valuedProducts).toBe(1);
    expect(summary.unvaluedProducts).toBe(1);
    expect(summary.valuationComplete).toBe(false);
    // Units are still counted — it's the money that's unknown, not the stock.
    expect(summary.totalUnits).toBe(14);
  });

  it('does not count an out-of-stock product as a valuation gap', () => {
    const positions = inventoryPositions([product({ stock: 0 })], []);
    expect(inventorySummary(positions).unvaluedProducts).toBe(0);
  });
});

describe('inventoryTurnover', () => {
  it('divides COGS by average inventory value', () => {
    expect(inventoryTurnover(1000, 250)).toBe(4);
  });

  it('returns null rather than a misleading zero', () => {
    expect(inventoryTurnover(0, 250)).toBeNull();
    expect(inventoryTurnover(1000, null)).toBeNull();
    expect(inventoryTurnover(1000, 0)).toBeNull();
  });
});

describe('openingUnits / drift', () => {
  it('unwinds movements to recover the opening stock level', () => {
    const range = resolveDateRange('last_7_days', null, NOW);
    const opening = openingUnits(
      [product({ stock: 15 })],
      [movement({ quantityChange: 10 }), movement({ id: 'm2', quantityChange: -3 })],
      range
    );
    // 15 now, +10 −3 during the period → 8 at the start.
    expect(opening.get('p1')).toBe(8);
  });

  it('surfaces drift between the ledger and actual stock', () => {
    const drifts = reconciliationDrift(
      [product({ stock: 12 })],
      [movement({ quantityChange: 10 })]
    );
    expect(drifts[0]).toMatchObject({ expected: 10, actual: 12, drift: 2 });
  });
});

describe('cashFlowSummary', () => {
  it('computes opening, net and closing balances from the ledger', () => {
    const before = new Date(2026, 6, 1);
    const transactions = [
      cash({ id: 'old', amount: 500, occurredAt: before }),
      cash({ id: 'in', amount: 300 }),
      cash({ id: 'out', direction: 'outflow', amount: 120, source: 'expense' }),
    ];
    const range = resolveDateRange('today', null, NOW);
    const summary = cashFlowSummary(transactions, range);

    expect(summary.openingBalance).toBe(500);
    expect(summary.inflows).toBe(300);
    expect(summary.outflows).toBe(120);
    expect(summary.netCashFlow).toBe(180);
    expect(summary.closingBalance).toBe(680);
  });

  it('excludes the period itself from the opening balance', () => {
    const range = resolveDateRange('today', null, NOW);
    expect(balanceBefore([cash({ amount: 100 })], range.start)).toBe(0);
  });

  it('splits movement by source and payment method', () => {
    const range = resolveDateRange('today', null, NOW);
    const summary = cashFlowSummary(
      [
        cash({ id: 'a', amount: 100, source: 'sale', paymentMethod: 'cash' }),
        cash({
          id: 'b',
          direction: 'outflow',
          amount: 40,
          source: 'purchase',
          paymentMethod: 'bank_transfer',
        }),
      ],
      range
    );
    expect(summary.bySource.find((g) => g.key === 'sale')?.inflow).toBe(100);
    expect(summary.byMethod.find((g) => g.key === 'bank_transfer')?.outflow).toBe(40);
  });

  it('carries the running balance across the daily series', () => {
    const range = resolveDateRange('last_7_days', null, NOW);
    const series = cashSeries(
      [cash({ id: 'old', amount: 1000, occurredAt: new Date(2026, 0, 1) }), cash({ amount: 50 })],
      range
    );
    expect(series[0].balance).toBe(1000);
    expect(series.at(-1)?.balance).toBe(1050);
  });
});

describe('metrics', () => {
  it('suppresses a comparison when there is no prior data at all', () => {
    const result = compare(500, 0, false);
    expect(result.status).toBe('unavailable');
    expect(result.changePercent).toBeNull();
  });

  it('refuses a percentage when growing from zero', () => {
    // "+100%" from a base of nothing is not information.
    const result = compare(500, 0, true);
    expect(result.status).toBe('from_zero');
    expect(result.changePercent).toBeNull();
    expect(result.direction).toBe('up');
  });

  it('computes a real percentage change when both periods have data', () => {
    expect(compare(150, 100, true)).toMatchObject({
      status: 'comparable',
      changePercent: 50,
      direction: 'up',
    });
    expect(compare(50, 100, true)).toMatchObject({ changePercent: -50, direction: 'down' });
  });

  it('avoids float drift when summing money', () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  it('returns null instead of Infinity or NaN', () => {
    expect(safeDivide(1, 0)).toBeNull();
    expect(percentOf(1, 0)).toBeNull();
  });
});

describe('csv', () => {
  it('quotes values containing commas, quotes and newlines', () => {
    expect(escapeCsvValue('a,b')).toBe('"a,b"');
    expect(escapeCsvValue('say "hi"')).toBe('"say ""hi"""');
  });

  it('neutralises spreadsheet formula injection from customer text', () => {
    // An order note like =HYPERLINK(...) must not execute when the CSV is opened.
    expect(escapeCsvValue('=1+1')).toBe("'=1+1");
    expect(escapeCsvValue('@SUM(A1)')).toBe("'@SUM(A1)");
    // Negative numbers are still numbers, not formulas.
    expect(escapeCsvValue(-5)).toBe('-5');
  });

  it('renders headers and rows', () => {
    const csv = toCsv(
      [{ name: 'A', qty: 2 }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'Qty', value: (r) => r.qty },
      ]
    );
    expect(csv).toBe('Name,Qty\r\nA,2\r\n');
  });
});
