/**
 * Storefront event tracker.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Three rules govern everything in this file:
 *
 * 1. **It can never break the storefront.** Every write is fire-and-forget and
 *    every failure is swallowed. A blocked Firestore rule, an offline visitor or
 *    a missing config must produce a silently untracked event, never a broken
 *    add-to-cart button.
 *
 * 2. **It collects nothing personal.** No IP, no user agent, no name, no email,
 *    no customer identity. `sessionId` is a random per-tab token held in
 *    `sessionStorage` — it lets the funnel count *sessions* without knowing who
 *    anyone is, and it disappears when the tab closes.
 *
 * 3. **It never tracks staff.** `/admin` and `/login` are excluded, so the
 *    owner's own browsing doesn't inflate the store's traffic figures.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * On Do Not Track: DNT signals object to *cross-site* tracking. These are
 * first-party, non-identifying counters with no profile, no cookie and no
 * third-party recipient, so the signal is not consulted. If BlueBuy ever adds a
 * cross-site pixel, that decision must be revisited.
 */
import { AnalyticsRepository } from '@/repositories/analytics.repository';
import { isFirebaseConfigured } from '@/firebase';
import { dayKey } from '@/lib/business/date-range';
import type { AnalyticsEventType } from '@/types/business';

const SESSION_KEY = 'bluebuy.analytics.session.v1';

/**
 * Cap on events per tab.
 *
 * Each event is a Firestore write, so a runaway loop or a bot hammering a page
 * would cost real money. Past the cap the tracker goes quiet for that tab.
 */
const MAX_EVENTS_PER_SESSION = 250;

let eventsThisSession = 0;

/** Paths whose traffic is internal and must not be counted. */
function isExcludedPath(path: string): boolean {
  return path.startsWith('/admin') || path.startsWith('/login');
}

/**
 * The current tab's random session id, created on first use.
 *
 * `sessionStorage` (not `localStorage`) is deliberate: a session should end with
 * the tab, which is what makes "sessions" a meaningful funnel denominator rather
 * than a device counter.
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 32)
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // Private browsing or storage disabled — untracked rather than broken.
    return null;
  }
}

/** What a caller may attach to an event. All fields optional and bounded. */
export interface TrackPayload {
  path?: string;
  productId?: string;
  productTitle?: string;
  categoryId?: string;
  brandId?: string;
  searchTerm?: string;
  resultCount?: number | null;
  quantity?: number | null;
  value?: number | null;
}

/** Trim a string to a maximum length, matching the schema's bounds. */
function bounded(value: string | undefined, max: number): string {
  if (!value) return '';
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Record a storefront event.
 *
 * Returns immediately; the write happens in the background. Safe to call during
 * render effects, event handlers, and on pages that may be prerendered.
 */
export function track(type: AnalyticsEventType, payload: TrackPayload = {}): void {
  // Server / build time — nothing to track.
  if (typeof window === 'undefined') return;
  if (!isFirebaseConfigured()) return;

  const path = payload.path ?? window.location.pathname;
  if (isExcludedPath(path)) return;

  if (eventsThisSession >= MAX_EVENTS_PER_SESSION) return;

  const sessionId = getSessionId();
  if (!sessionId) return;

  eventsThisSession += 1;

  // Deliberately not awaited: analytics must never sit in front of the UI.
  void AnalyticsRepository.record({
    type,
    sessionId,
    dayKey: dayKey(new Date()),
    // Query strings can carry search terms and other incidental data, so only
    // the pathname is ever stored.
    path: bounded(path, 300),
    productId: bounded(payload.productId, 120),
    productTitle: bounded(payload.productTitle, 200),
    categoryId: bounded(payload.categoryId, 120),
    brandId: bounded(payload.brandId, 120),
    searchTerm: bounded(normaliseSearchTerm(payload.searchTerm), 120),
    resultCount: payload.resultCount ?? null,
    quantity: payload.quantity ?? null,
    value: payload.value ?? null,
    occurredAt: null,
  }).catch(() => {
    // Swallowed by design — see rule 1 at the top of this file.
  });
}

/**
 * Normalise a search term so "Phone Case", "phone case " and "PHONE CASE" are
 * one row in the search report rather than three.
 */
export function normaliseSearchTerm(term: string | undefined): string {
  if (!term) return '';
  return term.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Reset the per-tab counter. Test seam; not used by the app. */
export function __resetSessionCounter(): void {
  eventsThisSession = 0;
}
