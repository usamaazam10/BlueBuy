/**
 * Funnel, traffic and search analytics.
 *
 * The behaviours worth protecting: the funnel counts sessions rather than
 * events, and every rate is withheld until there is enough traffic to state one
 * honestly.
 */
import { describe, expect, it } from 'vitest';
import type { AnalyticsEvent, AnalyticsEventType } from '@/types/business';
import {
  MIN_SESSIONS_FOR_RATE,
  addToCartRate,
  conversionFunnel,
  orderConversionRate,
  productConversionRate,
  productEngagement,
  searchTerms,
  sessionsWith,
  trafficSummary,
  topViewedProducts,
  zeroResultSearches,
} from './analytics';

let counter = 0;

function event(
  type: AnalyticsEventType,
  sessionId: string,
  overrides: Partial<AnalyticsEvent> = {}
): AnalyticsEvent {
  counter += 1;
  return {
    id: `e${counter}`,
    type,
    sessionId,
    dayKey: '2026-08-18',
    path: '/',
    productId: '',
    productTitle: '',
    categoryId: '',
    brandId: '',
    searchTerm: '',
    resultCount: null,
    quantity: null,
    value: null,
    occurredAt: new Date(2026, 7, 18),
    createdAt: new Date(2026, 7, 18),
    updatedAt: new Date(2026, 7, 18),
    ...overrides,
  };
}

/** `n` sessions that each produced one event of `type`. */
function sessions(type: AnalyticsEventType, n: number, prefix = 's'): AnalyticsEvent[] {
  return Array.from({ length: n }, (_, i) => event(type, `${prefix}${i}`));
}

describe('sessionsWith', () => {
  it('counts distinct sessions, not events', () => {
    const events = [
      event('product_view', 'a'),
      event('product_view', 'a'),
      event('product_view', 'a'),
      event('product_view', 'b'),
    ];
    expect(sessionsWith(events, 'product_view').size).toBe(2);
  });
});

describe('trafficSummary', () => {
  it('separates page views from sessions', () => {
    const events = [
      event('page_view', 'a'),
      event('page_view', 'a'),
      event('page_view', 'b'),
      event('product_view', 'b'),
    ];
    const summary = trafficSummary(events);
    expect(summary.pageViews).toBe(3);
    expect(summary.sessions).toBe(2);
    expect(summary.productViews).toBe(1);
    expect(summary.empty).toBe(false);
  });

  it('reports an empty period', () => {
    expect(trafficSummary([]).empty).toBe(true);
  });
});

describe('conversionFunnel', () => {
  it('withholds every rate below the reporting threshold', () => {
    const events = [...sessions('page_view', 5), ...sessions('checkout_completed', 1)];
    const funnel = conversionFunnel(events);

    expect(funnel.hasEnoughData).toBe(false);
    expect(funnel.note).toContain(String(MIN_SESSIONS_FOR_RATE));
    // Counts are still real and shown — it is only the *rates* that are withheld.
    expect(funnel.stages[0].sessions).toBe(5);
    expect(funnel.stages.every((stage) => stage.conversionFromPrevious === null)).toBe(true);
    expect(funnel.biggestDropOff).toBeNull();
  });

  it('says so distinctly when there is no traffic at all', () => {
    expect(conversionFunnel([]).note).toBe('No visits recorded in this period yet.');
  });

  it('computes stage-to-stage conversion once there is enough traffic', () => {
    const events = [
      ...sessions('page_view', 100, 'v'),
      ...sessions('product_view', 50, 'v'),
      ...sessions('add_to_cart', 20, 'v'),
      ...sessions('checkout_started', 10, 'v'),
      ...sessions('checkout_completed', 5, 'v'),
    ];
    const funnel = conversionFunnel(events);

    expect(funnel.hasEnoughData).toBe(true);
    expect(funnel.stages.map((s) => s.sessions)).toEqual([100, 50, 20, 10, 5]);
    expect(funnel.stages[1].conversionFromPrevious).toBe(50);
    expect(funnel.stages[2].conversionFromPrevious).toBe(40);
    expect(funnel.stages[4].conversionFromStart).toBe(5);
  });

  it('identifies the steepest proportional drop, not the largest absolute one', () => {
    // 100 → 90 loses 10 sessions (11%); 90 → 9 loses 81 (90%). The second is
    // the real problem even though both are big absolute numbers.
    const events = [
      ...sessions('page_view', 100, 'v'),
      ...sessions('product_view', 90, 'v'),
      ...sessions('add_to_cart', 9, 'v'),
      ...sessions('checkout_started', 8, 'v'),
      ...sessions('checkout_completed', 7, 'v'),
    ];
    expect(conversionFunnel(events).biggestDropOff?.key).toBe('add_to_cart');
  });

  it('does not inflate the top of the funnel when one session browses a lot', () => {
    // One very active session must not read as 40 visits.
    const busy = Array.from({ length: 40 }, () => event('page_view', 'single'));
    expect(conversionFunnel(busy).stages[0].sessions).toBe(1);
  });
});

describe('rates', () => {
  it('returns null below the threshold and a number above it', () => {
    expect(orderConversionRate(sessions('page_view', 5))).toBeNull();

    const events = [...sessions('page_view', 200, 'v'), ...sessions('checkout_completed', 10, 'v')];
    expect(orderConversionRate(events)).toBe(5);
  });

  it('measures add-to-cart against product viewers, not all visitors', () => {
    const events = [
      ...sessions('page_view', 500, 'v'),
      ...sessions('product_view', 100, 'v'),
      ...sessions('add_to_cart', 25, 'v'),
    ];
    expect(addToCartRate(events)).toBe(25);
  });

  it('withholds a per-product conversion rate on thin traffic', () => {
    expect(productConversionRate(4, 2)).toBeNull();
    expect(productConversionRate(200, 10)).toBe(5);
  });
});

describe('search', () => {
  it('ranks terms and counts zero-result searches', () => {
    const events = [
      event('search', 'a', { searchTerm: 'phone case', resultCount: 3 }),
      event('search', 'b', { searchTerm: 'phone case', resultCount: 3 }),
      event('search', 'c', { searchTerm: 'gold watch', resultCount: 0 }),
    ];
    const rows = searchTerms(events);

    expect(rows[0]).toMatchObject({ term: 'phone case', searches: 2, noResultSearches: 0 });
    expect(rows[1]).toMatchObject({ term: 'gold watch', noResultSearches: 1, lastResultCount: 0 });
  });

  it('surfaces unmet demand separately', () => {
    const events = [
      event('search', 'a', { searchTerm: 'popular', resultCount: 9 }),
      event('search', 'b', { searchTerm: 'missing thing', resultCount: 0 }),
      event('search', 'c', { searchTerm: 'missing thing', resultCount: 0 }),
    ];
    const rows = zeroResultSearches(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ term: 'missing thing', noResultSearches: 2 });
  });
});

describe('product engagement', () => {
  it('counts views, view sessions and cart adds per product', () => {
    const events = [
      event('product_view', 'a', { productId: 'p1', productTitle: 'One' }),
      event('product_view', 'a', { productId: 'p1', productTitle: 'One' }),
      event('product_view', 'b', { productId: 'p1', productTitle: 'One' }),
      event('add_to_cart', 'b', { productId: 'p1' }),
    ];
    const engagement = productEngagement(events);
    expect(engagement.get('p1')).toEqual({
      productId: 'p1',
      views: 3,
      viewSessions: 2,
      addToCarts: 1,
    });
  });

  it('ranks most-viewed products', () => {
    const events = [
      event('product_view', 'a', { productId: 'p1', productTitle: 'One' }),
      event('product_view', 'b', { productId: 'p2', productTitle: 'Two' }),
      event('product_view', 'c', { productId: 'p2', productTitle: 'Two' }),
    ];
    const top = topViewedProducts(events);
    expect(top[0]).toMatchObject({ id: 'p2', label: 'Two', views: 2, sessions: 2 });
  });
});
