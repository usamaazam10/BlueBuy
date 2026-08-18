/**
 * Customer analytics inferred from guest orders.
 *
 * Identity matching is the fragile part, so it is pinned here: the same person
 * with a differently-formatted phone number must be one customer, and contact
 * details must never leak into a display field.
 */
import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '@/types/order';
import { customerKey, customerRows, customerStats, maskPhone } from './customers';
import { resolveDateRange } from './date-range';

const NOW = new Date(2026, 7, 18);

function order(
  phone: string,
  total: number,
  createdAt: Date,
  overrides: Partial<Order> = {},
  id = `o${Math.random()}`
): Order {
  return {
    id,
    orderId: id,
    customer: { fullName: 'Aisha Khan', phone, city: 'Lahore', address: 'Street 1' },
    items: [
      {
        productId: 'p1',
        slug: 'p',
        title: 'P',
        accent: '#000',
        unitPrice: total,
        quantity: 1,
        lineTotal: total,
      },
    ],
    subtotal: total,
    shipping: 0,
    discount: 0,
    total,
    currency: 'USD',
    status: 'delivered' as OrderStatus,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

describe('customerKey', () => {
  it('treats differently-formatted phone numbers as one customer', () => {
    const a = order('0300-1234567', 10, NOW);
    const b = order('03001234567', 10, NOW);
    const c = order('+92 300 1234567', 10, NOW);

    expect(customerKey(a)).toBe(customerKey(b));
    // A country prefix genuinely differs, so this is a separate key — the
    // matching is deliberately conservative rather than clever.
    expect(customerKey(c)).not.toBe(customerKey(a));
    // The key must not carry the number itself; it ends up in DOM ids and CSVs.
    expect(customerKey(a)).not.toContain('1234567');
  });

  it('falls back to email when the phone is unusable, without exposing it', () => {
    const o = order('', 10, NOW, {
      customer: { fullName: 'A', phone: '', city: 'X', address: 'Y', email: 'A@Example.com' },
    });
    const key = customerKey(o);
    expect(key.startsWith('e_')).toBe(true);
    expect(key).not.toContain('example.com');

    // Case and surrounding whitespace must not split one person in two.
    const other = order('', 10, NOW, {
      customer: { fullName: 'A', phone: '', city: 'X', address: 'Y', email: ' a@example.com ' },
    });
    expect(customerKey(other)).toBe(key);
  });
});

describe('maskPhone', () => {
  it('exposes only the last four digits', () => {
    expect(maskPhone('0300-1234567')).toBe('••••4567');
    expect(maskPhone('12')).toBe('••••');
  });
});

describe('customerRows', () => {
  it('aggregates a repeat customer into one row', () => {
    const rows = customerRows([
      order('03001234567', 100, new Date(2026, 7, 1)),
      order('0300 123 4567', 300, new Date(2026, 7, 10)),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orders: 2,
      revenue: 400,
      averageOrderValue: 200,
      returning: true,
    });
  });

  it('never exposes a full phone number', () => {
    const rows = customerRows([order('03001234567', 100, NOW)]);
    expect(rows[0].maskedPhone).toBe('••••4567');
    expect(JSON.stringify(rows[0])).not.toContain('03001234567');
  });

  it('excludes cancelled and returned orders', () => {
    const rows = customerRows([
      order('03001234567', 100, NOW),
      order('03001234567', 999, NOW, { status: 'cancelled' }),
    ]);
    expect(rows[0].revenue).toBe(100);
    expect(rows[0].orders).toBe(1);
  });

  it('subtracts refunds from customer revenue', () => {
    const rows = customerRows([order('03001234567', 100, NOW, { refundedAmount: 40 })]);
    expect(rows[0].revenue).toBe(60);
  });
});

describe('customerStats', () => {
  const range = resolveDateRange('this_month', null, NOW);

  it('separates genuinely new customers from returning ones', () => {
    const orders = [
      // Ordered before this month, and again inside it → returning.
      order('03000000001', 100, new Date(2026, 5, 3)),
      order('03000000001', 100, new Date(2026, 7, 5)),
      // First ever order is inside the period → new.
      order('03000000002', 50, new Date(2026, 7, 9)),
    ];
    const stats = customerStats(orders, range);

    expect(stats.totalCustomers).toBe(2);
    expect(stats.newCustomers).toBe(1);
    expect(stats.returningCustomers).toBe(1);
  });

  it('returns nulls rather than zeros with no customers', () => {
    const stats = customerStats([], range);
    expect(stats.averageOrderValue).toBeNull();
    expect(stats.revenuePerCustomer).toBeNull();
    expect(stats.repeatRate).toBeNull();
  });

  it('always marks the figures as inferred', () => {
    // Customers are matched on contact details, not accounts — the caveat has
    // to travel with the numbers.
    expect(customerStats([order('03001234567', 10, NOW)], range).inferred).toBe(true);
  });
});
