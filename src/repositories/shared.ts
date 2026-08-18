/**
 * Helpers shared by the business-operations repositories.
 *
 * The catalogue repositories predate these and each define their own local
 * copies; rather than churn working code, new repositories share one
 * implementation here.
 */
import {
  collection,
  limit as limitTo,
  orderBy,
  query,
  where,
  type CollectionReference,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '@/firebase';
import type { DateRange } from '@/lib/business/date-range';

/** A typed collection reference by name. */
export function collectionRef(name: string): CollectionReference<DocumentData> {
  return collection(getDb(), name);
}

/** Map a Firestore snapshot into a typed document (data + doc id). */
export function fromSnapshot<T>(
  snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>
): T {
  return { ...(snapshot.data() as Omit<T, 'id'>), id: snapshot.id } as T;
}

/**
 * Recursively drop `undefined` properties.
 *
 * Firestore rejects `undefined`, so optional fields must be *absent* rather than
 * explicitly undefined. Zod leaves optional keys out, but object spreads and
 * form payloads reintroduce them, so every write passes through here.
 */
export function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => pruneUndefined(item)) as unknown as T;
  }
  // Date and Timestamp are objects but must be written through untouched.
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) out[key] = pruneUndefined(val);
    }
    return out as T;
  }
  return value;
}

/**
 * Build the constraints for a "records within a date range, newest first" query.
 *
 * Every business collection stores its own event-time field (`occurredAt`,
 * `incurredAt`, `receivedAt`), so the field name is a parameter. Filtering
 * server-side is what keeps the dashboard from pulling the whole history into
 * the browser (see BUSINESS_OPERATIONS.md § Performance).
 */
export function rangeConstraints(
  field: string,
  range?: DateRange | null,
  max?: number
): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];
  if (range) {
    constraints.push(where(field, '>=', range.start));
    constraints.push(where(field, '<', range.end));
  }
  constraints.push(orderBy(field, 'desc'));
  if (max) constraints.push(limitTo(max));
  return constraints;
}

/** Convenience: a query over a collection with the given constraints. */
export function queryIn(name: string, constraints: QueryConstraint[]) {
  return query(collectionRef(name), ...constraints);
}

/**
 * Default ceiling on how many rows a list query pulls. High enough to cover
 * real reporting periods for a growing store, low enough that a runaway query
 * can't lock the browser up.
 */
export const DEFAULT_QUERY_LIMIT = 2000;

/**
 * Generate a human-facing document number, e.g. `PO-260818-4F7A`.
 * Date-prefixed for at-a-glance recency; the random suffix keeps same-day
 * documents distinct.
 */
export function generateDocumentNumber(prefix: string, now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${yy}${mm}${dd}-${suffix}`;
}
