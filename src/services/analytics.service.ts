/**
 * AnalyticsService — reading storefront events for the admin.
 *
 * Writes go through `@/lib/analytics/tracker` (fire-and-forget, from the
 * storefront). This service is the read side, plus the daily-rollup rebuild.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Truncation is reported, not hidden.
 *
 * Analytics is the highest-volume collection in the app — one row per page view.
 * A read is capped, and when the cap is hit `truncated` is set so the dashboard
 * can say the range is partial rather than charting an arbitrary subset as if it
 * were the whole picture.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { AnalyticsRepository, MAX_EVENTS_PER_READ } from '@/repositories/analytics.repository';
import type { AnalyticsEvent } from '@/types/business';
import type { DateRange } from '@/lib/business/date-range';
import { dayKey, eachDayKey } from '@/lib/business/date-range';

/** Events for a period, with a flag when the read hit its ceiling. */
export interface AnalyticsWindow {
  events: AnalyticsEvent[];
  /** True when more events exist than were read. */
  truncated: boolean;
  /** True when the store has never recorded an event at all. */
  neverTracked: boolean;
}

export const analyticsService = {
  /**
   * Load events for a period.
   *
   * `neverTracked` distinguishes "the tracker has never run" from "nothing
   * happened in this window" — the dashboard says something different for each,
   * and conflating them would tell a new store it has no traffic when really it
   * has no *tracking*.
   */
  async window(range: DateRange): Promise<AnalyticsWindow> {
    const events = await AnalyticsRepository.listRange(range);

    if (events.length === 0) {
      const everTracked = await AnalyticsRepository.hasAnyEvents();
      return { events, truncated: false, neverTracked: !everTracked };
    }

    return {
      events,
      truncated: events.length >= MAX_EVENTS_PER_READ,
      neverTracked: false,
    };
  },

  /**
   * Rebuild the precomputed daily rollups for a period.
   *
   * Idempotent: each day's document is keyed by its `dayKey` and overwritten, so
   * running this twice produces the same result. Rollups are a read optimisation
   * only — raw events remain the source of truth, and the dashboards currently
   * read raw events directly. This exists so long-range reporting can move to
   * summaries once event volume makes that worthwhile.
   */
  async rebuildDailySummaries(range: DateRange): Promise<{ days: number; events: number }> {
    const { events } = await this.window(range);

    const byDay = new Map<
      string,
      {
        counts: Record<string, number>;
        sessions: Set<string>;
        productViews: Record<string, number>;
        searchTerms: Record<string, number>;
      }
    >();

    for (const key of eachDayKey(range)) {
      byDay.set(key, { counts: {}, sessions: new Set(), productViews: {}, searchTerms: {} });
    }

    for (const event of events) {
      const key = event.dayKey || dayKey(new Date());
      const bucket = byDay.get(key);
      if (!bucket) continue;

      bucket.counts[event.type] = (bucket.counts[event.type] ?? 0) + 1;
      if (event.sessionId) bucket.sessions.add(event.sessionId);
      if (event.type === 'product_view' && event.productId) {
        bucket.productViews[event.productId] = (bucket.productViews[event.productId] ?? 0) + 1;
      }
      if (event.type === 'search' && event.searchTerm) {
        bucket.searchTerms[event.searchTerm] = (bucket.searchTerms[event.searchTerm] ?? 0) + 1;
      }
    }

    let written = 0;
    for (const [key, bucket] of byDay) {
      // Skip days with nothing to record rather than writing empty documents.
      if (bucket.sessions.size === 0 && Object.keys(bucket.counts).length === 0) continue;
      await AnalyticsRepository.putDaily({
        dayKey: key,
        counts: bucket.counts,
        sessions: bucket.sessions.size,
        productViews: bucket.productViews,
        searchTerms: bucket.searchTerms,
      });
      written += 1;
    }

    return { days: written, events: events.length };
  },
};

export type AnalyticsService = typeof analyticsService;
