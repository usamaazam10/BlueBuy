/**
 * Delivery and fulfilment.
 *
 * The rate suppression is the point: a success rate computed from two
 * deliveries would read as a performance figure when it is a coincidence.
 */
import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '@/types/order';
import {
  MIN_DELIVERIES_FOR_RATE,
  courierPerformance,
  deliveryDays,
  deliverySummary,
  openOrders,
} from './delivery';
import { resolveDateRange } from './date-range';

const NOW = new Date(2026, 7, 18, 12, 0, 0);

function order(
  status: OrderStatus,
  delivery?: Partial<NonNullable<Order['delivery']>>,
  id = 'o1'
): Order {
  return {
    id,
    orderId: id,
    customer: { fullName: 'A', phone: '1234567', city: 'X', address: 'Y' },
    items: [
      {
        productId: 'p1',
        slug: 'p',
        title: 'P',
        accent: '#000',
        unitPrice: 10,
        quantity: 1,
        lineTotal: 10,
      },
    ],
    subtotal: 10,
    shipping: 0,
    discount: 0,
    total: 10,
    currency: 'USD',
    status,
    createdAt: NOW,
    updatedAt: NOW,
    ...(delivery
      ? {
          delivery: {
            courier: '',
            trackingNumber: '',
            deliveryCost: 0,
            shippedAt: null,
            expectedDeliveryAt: null,
            deliveredAt: null,
            notes: '',
            ...delivery,
          },
        }
      : {}),
  };
}

/** `n` delivered orders that each took `days` to arrive. */
function delivered(n: number, days: number, courier = 'Speedy'): Order[] {
  return Array.from({ length: n }, (_, i) =>
    order(
      'delivered',
      {
        courier,
        shippedAt: new Date(2026, 7, 10),
        deliveredAt: new Date(2026, 7, 10 + days),
      },
      `d${i}`
    )
  );
}

describe('openOrders', () => {
  it('excludes delivered, returned and cancelled', () => {
    const orders = [
      order('pending', undefined, 'a'),
      order('shipped', undefined, 'b'),
      order('delivered', undefined, 'c'),
      order('returned', undefined, 'd'),
      order('cancelled', undefined, 'e'),
    ];
    expect(openOrders(orders).map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('deliveryDays', () => {
  it('measures despatch to delivery', () => {
    const o = order('delivered', {
      shippedAt: new Date(2026, 7, 10),
      deliveredAt: new Date(2026, 7, 13),
    });
    expect(deliveryDays(o)).toBe(3);
  });

  it('returns null when either timestamp is missing', () => {
    expect(deliveryDays(order('delivered', { shippedAt: new Date(2026, 7, 10) }))).toBeNull();
    expect(deliveryDays(order('delivered'))).toBeNull();
  });

  it('rejects a negative span rather than dragging the average below zero', () => {
    const o = order('delivered', {
      shippedAt: new Date(2026, 7, 13),
      deliveredAt: new Date(2026, 7, 10),
    });
    expect(deliveryDays(o)).toBeNull();
  });
});

describe('deliverySummary', () => {
  const range = resolveDateRange('last_30_days', null, NOW);
  const today = resolveDateRange('today', null, NOW);

  it('groups open orders by fulfilment stage', () => {
    const orders = [
      order('pending', undefined, 'a'),
      order('processing', undefined, 'b'),
      order('packed', undefined, 'c'),
      order('out_for_delivery', undefined, 'd'),
    ];
    const summary = deliverySummary(orders, range, today);

    expect(summary.stages.find((s) => s.key === 'awaiting')?.count).toBe(2);
    expect(summary.stages.find((s) => s.key === 'packed')?.count).toBe(1);
    expect(summary.stages.find((s) => s.key === 'out_for_delivery')?.count).toBe(1);
    expect(summary.openOrders).toBe(4);
  });

  it('withholds the success rate and average below the threshold', () => {
    const summary = deliverySummary(delivered(3, 2), range, today);
    expect(summary.successRate).toBeNull();
    expect(summary.averageDeliveryDays).toBeNull();
    // The underlying counts are still real and reported.
    expect(summary.averageSampleSize).toBe(3);
  });

  it('reports both once there are enough deliveries', () => {
    const orders = [
      ...delivered(MIN_DELIVERIES_FOR_RATE, 4),
      order('delivery_failed', undefined, 'f1'),
    ];
    const summary = deliverySummary(orders, range, today);

    expect(summary.averageDeliveryDays).toBe(4);
    // 10 delivered of 11 attempts.
    expect(summary.successRate).toBe(90.9);
    expect(summary.failedDeliveries).toBe(1);
  });
});

describe('courierPerformance', () => {
  it('ranks couriers by volume and withholds thin rates', () => {
    const orders = [
      ...delivered(MIN_DELIVERIES_FOR_RATE, 3, 'Speedy'),
      ...delivered(2, 9, 'Slowpoke'),
    ];
    const rows = courierPerformance(orders);

    expect(rows[0].courier).toBe('Speedy');
    expect(rows[0].averageDeliveryDays).toBe(3);
    expect(rows[1].courier).toBe('Slowpoke');
    expect(rows[1].averageDeliveryDays).toBeNull();
  });

  it('ignores orders with no courier recorded', () => {
    expect(courierPerformance([order('shipped')])).toHaveLength(0);
  });
});
