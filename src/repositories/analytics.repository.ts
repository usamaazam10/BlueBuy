/**
 * AnalyticsRepository — the gateway to `analytics_events` and `analytics_daily`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Writes come from unauthenticated storefront visitors.
 *
 * That makes this the second anonymous write path in the app (after order
 * creation), so it is deliberately narrow: a fixed set of bounded fields,
 * validated by Zod here and re-validated by a `hasOnly` security rule that
 * mirrors it exactly. There is no free-form blob, nothing unbounded, and
 * **nothing personal** — no IP, no user agent, no customer identity. The
 * `sessionId` is a random per-tab token, not an identifier for a person.
 *
 * Events are read only by staff. A visitor can append but can never read back
 * what anyone else did.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb, withAppError } from '@/firebase';
import { COLLECTIONS } from '@/types/models';
import type { AnalyticsDailySummary, AnalyticsEvent } from '@/types/business';
import {
  analyticsEventCreateSchema,
  analyticsDailySummarySchema,
  type AnalyticsEventCreateInput,
} from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import { dayKey } from '@/lib/business/date-range';
import { collectionRef, fromSnapshot, pruneUndefined } from './shared';

const EVENTS = COLLECTIONS.analyticsEvents;
const DAILY = COLLECTIONS.analyticsDaily;

/**
 * Ceiling on how many raw events a single dashboard read will pull.
 *
 * Analytics events are by far the highest-volume collection here — one row per
 * page view. This cap is what keeps a busy month from being streamed into the
 * browser; `AnalyticsService` reports when a range was truncated rather than
 * silently charting a partial picture.
 */
export const MAX_EVENTS_PER_READ = 5000;

export const AnalyticsRepository = {
  /**
   * Append one event.
   *
   * Callers are fire-and-forget: analytics must never be able to break a page.
   * See `tracker.ts`, which swallows the rejection.
   */
  async record(input: AnalyticsEventCreateInput): Promise<void> {
    const data = analyticsEventCreateSchema.parse(input);
    await addDoc(collectionRef(EVENTS), {
      ...pruneUndefined(data),
      occurredAt: data.occurredAt ?? serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Raw events for a period, filtered on `dayKey`.
   *
   * Filtering on the day string rather than the timestamp is deliberate: it is a
   * single indexed equality-range on one field, which keeps the query on
   * Firestore's automatic index and matches how the events were bucketed when
   * written (in the visitor's local time).
   */
  async listRange(range: DateRange, max = MAX_EVENTS_PER_READ): Promise<AnalyticsEvent[]> {
    return withAppError(async () => {
      const startKey = dayKey(range.start);
      // `end` is exclusive; step back one millisecond to get the last real day.
      const endKey = dayKey(new Date(range.end.getTime() - 1));

      const constraints: QueryConstraint[] = [
        where('dayKey', '>=', startKey),
        where('dayKey', '<=', endKey),
        orderBy('dayKey', 'desc'),
        limitTo(max),
      ];
      const snap = await getDocs(query(collectionRef(EVENTS), ...constraints));
      return snap.docs.map((d) => fromSnapshot<AnalyticsEvent>(d));
    }, 'load analytics');
  },

  /** Whether any event exists at all — drives the "no data yet" state. */
  async hasAnyEvents(): Promise<boolean> {
    return withAppError(async () => {
      const snap = await getDocs(query(collectionRef(EVENTS), limitTo(1)));
      return !snap.empty;
    }, 'load analytics');
  },

  /** A precomputed daily rollup, or `null`. */
  async getDaily(key: string): Promise<AnalyticsDailySummary | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), DAILY, key));
      return snapshot.exists() ? fromSnapshot<AnalyticsDailySummary>(snapshot) : null;
    }, 'load analytics summary');
  },

  /**
   * Write a daily rollup. Keyed by `dayKey`, so rebuilding a day overwrites it
   * rather than accumulating duplicates — the rebuild is idempotent.
   */
  async putDaily(summary: {
    dayKey: string;
    counts: Record<string, number>;
    sessions: number;
    productViews: Record<string, number>;
    searchTerms: Record<string, number>;
  }): Promise<void> {
    const data = analyticsDailySummarySchema.parse({ ...summary, computedAt: null });
    return withAppError(async () => {
      await setDoc(doc(getDb(), DAILY, summary.dayKey), {
        ...pruneUndefined(data),
        computedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }, 'save analytics summary');
  },
};

export type AnalyticsRepositoryType = typeof AnalyticsRepository;
