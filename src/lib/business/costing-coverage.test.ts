/**
 * Regression tests for the rule that matters most in this codebase:
 * **an unknown cost is never reported as a cost of zero.**
 *
 * The gap these cover: capturing costs on an order whose products have no cost
 * basis stores a snapshot with *no lines* and `totalCost: 0`. Read naively that
 * is a free cost of goods, and the P&L printed gross profit == net sales — a
 * 100% margin — labelled merely "partial". Every product in the live catalogue
 * was in exactly that state, so this was not a theoretical case.
 */
import { describe, expect, it } from 'vitest';
import { buildCosting } from '@/services/order-fulfilment.service';
import type { Order } from '@/types/order';
import type { Product } from '@/types/models';
import type { ActorRef } from '@/types/business';
import { cogsSummary, hasCompleteCosting, orderCogs } from './sales';
import { profitAndLoss } from './profit';

const actor: ActorRef = { uid: 'u1', email: 'a@b.c', label: 'Admin' };

function order(over: Partial<Order> = {}): Order {
  return {
    id: 'BB-1',
    orderId: 'BB-1',
    customer: { fullName: 'A', phone: '03001234567', city: 'Karachi', address: 'X' },
    items: [
      {
        productId: 'p1',
        slug: 'p1',
        title: 'Widget',
        accent: '#fff',
        unitPrice: 10_000,
        quantity: 1,
        lineTotal: 10_000,
      },
    ],
    subtotal: 10_000,
    shipping: 0,
    discount: 0,
    total: 10_000,
    currency: 'PKR',
    status: 'delivered',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...over,
  } as Order;
}

const uncosted = { id: 'p1', title: 'Widget', stock: 5 } as Product;
const costed = { id: 'p1', title: 'Widget', stock: 5, averageCost: 6_000 } as Product;

describe('cost capture on a product with no cost basis', () => {
  it('produces an empty, incomplete snapshot rather than a zero cost', () => {
    const { costing, missing } = buildCosting(order(), new Map([['p1', uncosted]]), actor);
    expect(costing.lines).toHaveLength(0);
    expect(costing.complete).toBe(false);
    expect(missing).toEqual(['Widget']);
  });

  it('reports that order as UNCOSTED, not as a zero cost of goods', () => {
    const { costing } = buildCosting(order(), new Map([['p1', uncosted]]), actor);
    const withSnapshot = order({ costing });

    expect(orderCogs(withSnapshot)).toBeNull();
    expect(hasCompleteCosting(withSnapshot)).toBe(false);

    const summary = cogsSummary([withSnapshot]);
    expect(summary.uncostedOrders).toBe(1);
    expect(summary.partialOrders).toBe(0);
    expect(summary.coveragePercent).toBe(0);
  });

  it('refuses to print a profit figure — never a 100% margin', () => {
    const { costing } = buildCosting(order(), new Map([['p1', uncosted]]), actor);
    const pl = profitAndLoss([order({ costing })], []);

    expect(pl.sales.netSales).toBe(10_000);
    expect(pl.grossProfit).toBeNull();
    expect(pl.grossMarginPercent).toBeNull();
    expect(pl.operatingProfit).toBeNull();
    expect(pl.dataQuality).toBe('unavailable');
  });
});

describe('cost capture on a product with a real cost basis', () => {
  it('still reports profit normally', () => {
    const { costing } = buildCosting(order(), new Map([['p1', costed]]), actor);
    const pl = profitAndLoss([order({ costing })], []);

    expect(costing.complete).toBe(true);
    expect(costing.totalCost).toBe(6_000);
    expect(pl.grossProfit).toBe(4_000);
    expect(pl.grossMarginPercent).toBe(40);
    expect(pl.dataQuality).toBe('complete');
  });

  it('historical margin does not move when the product is later repriced', () => {
    const { costing } = buildCosting(order(), new Map([['p1', costed]]), actor);
    const historical = order({ costing });

    // The product's cost basis triples after the sale.
    const repriced = { ...costed, averageCost: 18_000 } as Product;
    expect(repriced.averageCost).toBe(18_000);

    // The captured snapshot is what reporting uses, so profit is unchanged.
    expect(profitAndLoss([historical], []).grossProfit).toBe(4_000);
  });
});

describe('delivery costs in the P&L', () => {
  const delivered = (cost: number, over: Partial<Order> = {}) =>
    order({
      delivery: {
        courier: 'Local',
        trackingNumber: 'T1',
        deliveryCost: cost,
        shippedAt: null,
        expectedDeliveryAt: null,
        deliveredAt: null,
        notes: '',
      },
      ...over,
    } as Partial<Order>);

  it('subtracts courier costs from operating profit', () => {
    const { costing } = buildCosting(order(), new Map([['p1', costed]]), actor);
    const pl = profitAndLoss([delivered(500, { costing })], []);

    expect(pl.grossProfit).toBe(4_000);
    expect(pl.deliveryCosts).toBe(500);
    expect(pl.operatingCosts).toBe(500);
    expect(pl.operatingProfit).toBe(3_500);
  });

  it('counts delivery cost on a returned order too — the courier was still paid', () => {
    const pl = profitAndLoss([delivered(500, { status: 'returned' })], []);
    expect(pl.sales.netSales).toBe(0);
    expect(pl.deliveryCosts).toBe(500);
  });

  it('warns when courier spend is recorded on orders AND as an expense', () => {
    const expense = {
      id: 'e1',
      amount: 500,
      currency: 'PKR',
      categoryId: 'c-ship',
      categoryName: 'Shipping',
      isInventoryProcurement: false,
      incurredAt: new Date('2026-08-01'),
      description: 'Courier bill',
    } as never;

    expect(profitAndLoss([delivered(500)], [expense]).deliveryCostNote).toContain('twice');
    expect(profitAndLoss([delivered(500)], []).deliveryCostNote).toBeNull();
    expect(profitAndLoss([delivered(0)], [expense]).deliveryCostNote).toBeNull();
  });
});
