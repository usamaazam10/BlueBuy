/**
 * Number/money formatting helpers.
 *
 * Money is always rendered through {@link formatPrice}. The currency it uses is
 * the store's configured ISO code (admin → CMS → Site settings → Regional), not
 * a hard-coded one:
 *
 *  - **Components** should call `useCurrency()` (`@/hooks/use-currency`) so they
 *    re-render when the setting loads or changes.
 *  - **Non-React code** (the WhatsApp message builder, the order service) reads
 *    the module-level active currency, kept in sync with `site_settings` by
 *    `SiteSettingsRuntime`.
 *  - Records that carry their own code — an `Order` — pass it explicitly, so a
 *    past order keeps rendering in the currency it was placed with.
 */

/** Normalize a user-supplied code to `AAA`, or `null` when unusable. */
function normalizeCurrency(code: string | null | undefined): string | null {
  const trimmed = code?.trim().toUpperCase();
  return trimmed && /^[A-Z]{3}$/.test(trimmed) ? trimmed : null;
}

/**
 * Fallback used before `site_settings` loads, and when a code is missing.
 *
 * This is the **build-time** currency, inlined identically into the prerendered
 * HTML and the client bundle, so server and client agree on the very first paint
 * and hydration never mismatches.
 *
 * Normally unused: the root layout reads `site_settings` at build time and
 * seeds it into React Query, so prerendered pages already carry the store's
 * real currency. This is the last-resort fallback for when that read fails
 * (Firestore unreachable or locked down during the build) — without it those
 * builds would ship `$` in visible markup while the same page's Product JSON-LD
 * carried the real code.
 *
 * `NEXT_PUBLIC_DEFAULT_CURRENCY` is therefore optional. Set it only if your
 * build cannot reach Firestore; it must match CMS → Site settings → Regional.
 */
export const DEFAULT_CURRENCY =
  normalizeCurrency(process.env.NEXT_PUBLIC_DEFAULT_CURRENCY) ?? 'USD';

let activeCurrency = DEFAULT_CURRENCY;

/**
 * Set the store-wide currency used by {@link formatPrice} when no explicit code
 * is passed. Called by `SiteSettingsRuntime` whenever `site_settings` resolves;
 * an invalid/empty code resets to {@link DEFAULT_CURRENCY}.
 */
export function setActiveCurrency(code: string | null | undefined): void {
  activeCurrency = normalizeCurrency(code) ?? DEFAULT_CURRENCY;
}

/** The store-wide currency currently in effect. */
export function getActiveCurrency(): string {
  return activeCurrency;
}

/**
 * Format a number as money, without trailing cents when whole.
 *
 * @param value  Amount in major units.
 * @param currency  ISO 4217 code; defaults to the store's active currency.
 */
export function formatPrice(value: number, currency?: string | null): string {
  const code = normalizeCurrency(currency) ?? activeCurrency;
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: code,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  };
  try {
    return new Intl.NumberFormat('en-US', options).format(value);
  } catch {
    // An unknown-but-well-formed code (e.g. a typo) makes Intl throw on some
    // engines — degrade to "XYZ 1,234" rather than blanking the price.
    return `${code} ${new Intl.NumberFormat('en-US', {
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: 2,
    }).format(value)}`;
  }
}

/** Compact number formatting, e.g. 1284 -> "1.3k". */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
