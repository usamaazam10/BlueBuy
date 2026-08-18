/**
 * Storefront analytics calculations — traffic, funnel, search and product views.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The funnel is measured in **sessions, not events**.
 *
 * A visitor who views six products has not "converted 6×" — they are one session
 * that reached the product-view stage. Counting raw events would inflate the top
 * of the funnel and make every conversion rate below it look far worse than it
 * is. Each stage therefore counts *distinct sessions that reached it*.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Rates are withheld until they mean something.
 *
 * A conversion rate computed from three sessions is noise presented as insight.
 * Every rate here returns `null` when its denominator is zero or below
 * {@link MIN_SESSIONS_FOR_RATE}, and the UI renders "not enough data" instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { AnalyticsEvent, AnalyticsEventType } from '@/types/business';
import type { DateRange } from './date-range';
import { dayKey, eachDayKey, toDate } from './date-range';
import { percentOf, roundPercent } from './metrics';

/**
 * Below this many sessions a conversion rate is not reported.
 *
 * Chosen so a single visitor's behaviour can't read as a business trend: at 30
 * sessions one extra conversion moves the rate by ~3 points, which is noisy but
 * no longer meaningless. It is a judgement call, not a statistical guarantee.
 */
export const MIN_SESSIONS_FOR_RATE = 30;

/** Events of one type. */
export function eventsOfType(
  events: readonly AnalyticsEvent[],
  type: AnalyticsEventType
): AnalyticsEvent[] {
  return events.filter((event) => event.type === type);
}

/** Distinct sessions that produced at least one event of a type. */
export function sessionsWith(
  events: readonly AnalyticsEvent[],
  type: AnalyticsEventType
): Set<string> {
  const sessions = new Set<string>();
  for (const event of events) {
    if (event.type === type && event.sessionId) sessions.add(event.sessionId);
  }
  return sessions;
}

// ────────────────────────────── Traffic ──────────────────────────────────────

export interface TrafficPoint {
  dayKey: string;
  pageViews: number;
  sessions: number;
  productViews: number;
}

/**
 * Daily traffic series. Sessions are counted per day (a session spanning
 * midnight counts on both days — it was active on both).
 */
export function trafficSeries(events: readonly AnalyticsEvent[], range: DateRange): TrafficPoint[] {
  const buckets = new Map<
    string,
    { pageViews: number; productViews: number; sessions: Set<string> }
  >();
  for (const key of eachDayKey(range)) {
    buckets.set(key, { pageViews: 0, productViews: 0, sessions: new Set() });
  }

  for (const event of events) {
    // Prefer the stored dayKey — it is the visitor's local day, which is how the
    // event was bucketed at write time.
    const key = event.dayKey || (toDate(event.occurredAt) ? dayKey(toDate(event.occurredAt)!) : '');
    const bucket = buckets.get(key);
    if (!bucket) continue;

    if (event.sessionId) bucket.sessions.add(event.sessionId);
    if (event.type === 'page_view') bucket.pageViews += 1;
    if (event.type === 'product_view') bucket.productViews += 1;
  }

  return [...buckets.entries()].map(([key, bucket]) => ({
    dayKey: key,
    pageViews: bucket.pageViews,
    productViews: bucket.productViews,
    sessions: bucket.sessions.size,
  }));
}

/** Headline traffic figures for a period. */
export interface TrafficSummary {
  pageViews: number;
  sessions: number;
  productViews: number;
  /** True when the period contains no events at all. */
  empty: boolean;
}

export function trafficSummary(events: readonly AnalyticsEvent[]): TrafficSummary {
  const sessions = new Set<string>();
  let pageViews = 0;
  let productViews = 0;

  for (const event of events) {
    if (event.sessionId) sessions.add(event.sessionId);
    if (event.type === 'page_view') pageViews += 1;
    if (event.type === 'product_view') productViews += 1;
  }

  return {
    pageViews,
    sessions: sessions.size,
    productViews,
    empty: events.length === 0,
  };
}

// ─────────────────────────────── Funnel ──────────────────────────────────────

/** One stage of the conversion funnel. */
export interface FunnelStage {
  key: 'visit' | 'product_view' | 'add_to_cart' | 'checkout_started' | 'order_completed';
  label: string;
  /** Distinct sessions that reached this stage. */
  sessions: number;
  /**
   * Percentage of the *previous* stage that reached this one, or `null` when
   * there isn't enough data to state one honestly.
   */
  conversionFromPrevious: number | null;
  /** Percentage of the *first* stage that reached this one, or `null`. */
  conversionFromStart: number | null;
  /** Sessions lost between the previous stage and this one. */
  dropOff: number;
}

export interface Funnel {
  stages: FunnelStage[];
  /** The stage with the largest proportional loss, or `null` when unknown. */
  biggestDropOff: FunnelStage | null;
  /** True when there is enough traffic to report rates at all. */
  hasEnoughData: boolean;
  /** Explanation when `hasEnoughData` is false. */
  note: string | null;
}

const FUNNEL_DEFINITION: { key: FunnelStage['key']; label: string; type: AnalyticsEventType }[] = [
  { key: 'visit', label: 'Visits', type: 'page_view' },
  { key: 'product_view', label: 'Product views', type: 'product_view' },
  { key: 'add_to_cart', label: 'Added to cart', type: 'add_to_cart' },
  { key: 'checkout_started', label: 'Checkout started', type: 'checkout_started' },
  { key: 'order_completed', label: 'Order placed', type: 'checkout_completed' },
];

/**
 * Build the conversion funnel.
 *
 * Rates are suppressed wholesale below {@link MIN_SESSIONS_FOR_RATE} visits —
 * a funnel drawn from a handful of sessions would read as a finding when it is
 * only noise.
 */
export function conversionFunnel(events: readonly AnalyticsEvent[]): Funnel {
  const counts = FUNNEL_DEFINITION.map((stage) => ({
    ...stage,
    sessions: sessionsWith(events, stage.type).size,
  }));

  const startSessions = counts[0]?.sessions ?? 0;
  const hasEnoughData = startSessions >= MIN_SESSIONS_FOR_RATE;

  const stages: FunnelStage[] = counts.map((stage, index) => {
    const previous = index === 0 ? null : counts[index - 1].sessions;
    const dropOff = previous === null ? 0 : Math.max(0, previous - stage.sessions);

    return {
      key: stage.key,
      label: stage.label,
      sessions: stage.sessions,
      conversionFromPrevious:
        !hasEnoughData || previous === null || previous === 0
          ? null
          : percentOf(stage.sessions, previous),
      conversionFromStart:
        !hasEnoughData || index === 0 || startSessions === 0
          ? null
          : percentOf(stage.sessions, startSessions),
      dropOff,
    };
  });

  // The biggest drop-off is the steepest *proportional* fall, not the largest
  // absolute one — losing 90% of 100 sessions matters more than 50% of 150.
  let biggest: FunnelStage | null = null;
  let biggestLossRate = -1;
  if (hasEnoughData) {
    for (let index = 1; index < stages.length; index += 1) {
      const previous = stages[index - 1].sessions;
      if (previous === 0) continue;
      const lossRate = stages[index].dropOff / previous;
      if (lossRate > biggestLossRate) {
        biggestLossRate = lossRate;
        biggest = stages[index];
      }
    }
  }

  return {
    stages,
    biggestDropOff: biggest,
    hasEnoughData,
    note: hasEnoughData
      ? null
      : startSessions === 0
        ? 'No visits recorded in this period yet.'
        : `Only ${startSessions} session${startSessions === 1 ? '' : 's'} recorded — conversion rates are shown once there are at least ${MIN_SESSIONS_FOR_RATE}.`,
  };
}

/**
 * Order conversion rate: sessions that placed an order ÷ sessions that visited.
 * `null` below the reporting threshold.
 */
export function orderConversionRate(events: readonly AnalyticsEvent[]): number | null {
  const visits = sessionsWith(events, 'page_view').size;
  if (visits < MIN_SESSIONS_FOR_RATE) return null;
  return percentOf(sessionsWith(events, 'checkout_completed').size, visits);
}

/** Add-to-cart rate: sessions that added ÷ sessions that viewed a product. */
export function addToCartRate(events: readonly AnalyticsEvent[]): number | null {
  const viewers = sessionsWith(events, 'product_view').size;
  if (viewers < MIN_SESSIONS_FOR_RATE) return null;
  return percentOf(sessionsWith(events, 'add_to_cart').size, viewers);
}

// ────────────────────────── Views & search ───────────────────────────────────

export interface ViewCount {
  id: string;
  label: string;
  views: number;
  /** Distinct sessions that viewed it. */
  sessions: number;
}

/** Product view counts, most-viewed first. */
export function topViewedProducts(events: readonly AnalyticsEvent[], max = 10): ViewCount[] {
  return rankViews(events, 'product_view', (event) => ({
    id: event.productId,
    label: event.productTitle || event.productId,
  })).slice(0, max);
}

/** Category view counts, most-viewed first. */
export function topViewedCategories(
  events: readonly AnalyticsEvent[],
  names: ReadonlyMap<string, string>,
  max = 10
): ViewCount[] {
  return rankViews(events, 'category_view', (event) => ({
    id: event.categoryId,
    label: names.get(event.categoryId) ?? event.categoryId,
  })).slice(0, max);
}

function rankViews(
  events: readonly AnalyticsEvent[],
  type: AnalyticsEventType,
  keyOf: (event: AnalyticsEvent) => { id: string; label: string }
): ViewCount[] {
  const groups = new Map<string, { label: string; views: number; sessions: Set<string> }>();

  for (const event of events) {
    if (event.type !== type) continue;
    const { id, label } = keyOf(event);
    if (!id) continue;

    const entry = groups.get(id) ?? { label, views: 0, sessions: new Set<string>() };
    entry.views += 1;
    if (event.sessionId) entry.sessions.add(event.sessionId);
    groups.set(id, entry);
  }

  return [...groups.entries()]
    .map(([id, entry]) => ({
      id,
      label: entry.label,
      views: entry.views,
      sessions: entry.sessions.size,
    }))
    .sort((a, b) => b.views - a.views);
}

/** One row of the search report. */
export interface SearchTermRow {
  term: string;
  searches: number;
  /** Searches that returned nothing — demand the catalogue isn't meeting. */
  noResultSearches: number;
  /** Most recent result count seen for this term, or `null` if never recorded. */
  lastResultCount: number | null;
}

/**
 * Search terms, most-searched first.
 *
 * `noResultSearches` is the commercially interesting column: it is a list of
 * things customers asked for and BlueBuy could not show them.
 */
export function searchTerms(events: readonly AnalyticsEvent[], max = 25): SearchTermRow[] {
  const groups = new Map<string, { searches: number; noResults: number; last: number | null }>();

  for (const event of events) {
    if (event.type !== 'search') continue;
    const term = event.searchTerm;
    if (!term) continue;

    const entry = groups.get(term) ?? { searches: 0, noResults: 0, last: null };
    entry.searches += 1;
    if (event.resultCount === 0) entry.noResults += 1;
    if (typeof event.resultCount === 'number') entry.last = event.resultCount;
    groups.set(term, entry);
  }

  return [...groups.entries()]
    .map(([term, entry]) => ({
      term,
      searches: entry.searches,
      noResultSearches: entry.noResults,
      lastResultCount: entry.last,
    }))
    .sort((a, b) => b.searches - a.searches)
    .slice(0, max);
}

/** Searches that found nothing, ranked by how often they were tried. */
export function zeroResultSearches(events: readonly AnalyticsEvent[], max = 15): SearchTermRow[] {
  return searchTerms(events, Number.MAX_SAFE_INTEGER)
    .filter((row) => row.noResultSearches > 0)
    .sort((a, b) => b.noResultSearches - a.noResultSearches)
    .slice(0, max);
}

// ─────────────────────── Per-product engagement ──────────────────────────────

/** Views and cart adds per product, for the product-performance report. */
export interface ProductEngagement {
  productId: string;
  views: number;
  viewSessions: number;
  addToCarts: number;
}

export function productEngagement(
  events: readonly AnalyticsEvent[]
): Map<string, ProductEngagement> {
  const map = new Map<string, ProductEngagement & { sessions: Set<string> }>();

  const ensure = (productId: string) => {
    let entry = map.get(productId);
    if (!entry) {
      entry = {
        productId,
        views: 0,
        viewSessions: 0,
        addToCarts: 0,
        sessions: new Set<string>(),
      };
      map.set(productId, entry);
    }
    return entry;
  };

  for (const event of events) {
    if (!event.productId) continue;
    if (event.type === 'product_view') {
      const entry = ensure(event.productId);
      entry.views += 1;
      if (event.sessionId) entry.sessions.add(event.sessionId);
    } else if (event.type === 'add_to_cart') {
      ensure(event.productId).addToCarts += 1;
    }
  }

  const out = new Map<string, ProductEngagement>();
  for (const [id, entry] of map) {
    out.set(id, {
      productId: entry.productId,
      views: entry.views,
      viewSessions: entry.sessions.size,
      addToCarts: entry.addToCarts,
    });
  }
  return out;
}

/**
 * View-to-order conversion for one product, or `null` when it has too few views
 * to state a rate.
 */
export function productConversionRate(views: number, orders: number): number | null {
  if (views < MIN_SESSIONS_FOR_RATE) return null;
  return roundPercent((orders / views) * 100);
}
