/**
 * localStorage persistence for the cart.
 *
 * Everything here is defensive: reads/writes are wrapped so private-mode quota
 * errors, disabled storage, or a corrupt/legacy payload degrade to an empty
 * cart instead of crashing the app. The payload is versioned so the schema can
 * evolve without choking on data written by an older build.
 */
import type { CartItem } from '@/types/cart';

const STORAGE_KEY = 'bluebuy.cart.v1';
const SCHEMA_VERSION = 1;

interface PersistedCart {
  version: number;
  items: CartItem[];
}

/** True only in a browser with a usable localStorage (SSR/static-export safe). */
function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Narrow an unknown value to a well-formed CartItem, discarding junk. */
function isValidItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.slug === 'string' &&
    typeof item.title === 'string' &&
    typeof item.unitPrice === 'number' &&
    Number.isFinite(item.unitPrice) &&
    typeof item.quantity === 'number' &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0
  );
}

/** Load the persisted cart. Returns `[]` on any failure — never throws. */
export function loadCart(): CartItem[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PersistedCart>;
    if (!parsed || parsed.version !== SCHEMA_VERSION || !Array.isArray(parsed.items)) {
      return [];
    }
    return parsed.items.filter(isValidItem);
  } catch {
    // Corrupt JSON, blocked storage, etc. — start clean.
    return [];
  }
}

/** Persist the cart. Silently no-ops if storage is unavailable or full. */
export function saveCart(items: CartItem[]): void {
  if (!hasStorage()) return;
  try {
    const payload: PersistedCart = { version: SCHEMA_VERSION, items };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded / private mode — non-fatal, cart still works in memory.
  }
}

/** Remove the persisted cart entirely. */
export function clearStoredCart(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
