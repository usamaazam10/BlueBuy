'use client';

import * as React from 'react';
import { useSiteSettings } from '@/hooks/queries';
import { DEFAULT_CURRENCY, formatPrice as formatWithCurrency } from '@/lib/format';

/** What {@link useCurrency} returns. */
export interface UseCurrency {
  /** The store's active ISO 4217 code (from `site_settings`). */
  currency: string;
  /**
   * Format an amount in the store's currency. Pass a code to override it —
   * used for orders, which render in the currency they were placed with.
   */
  formatPrice: (value: number, currency?: string | null) => string;
}

/**
 * Money formatting bound to the store's configured currency.
 *
 * Components must use this rather than importing `formatPrice` directly: it
 * subscribes to `site_settings`, so prices re-render when an admin changes the
 * currency instead of keeping whatever code was in effect on first paint.
 */
export function useCurrency(): UseCurrency {
  const { data: settings } = useSiteSettings();
  const currency = settings?.currency || DEFAULT_CURRENCY;

  const formatPrice = React.useCallback(
    (value: number, override?: string | null) => formatWithCurrency(value, override ?? currency),
    [currency]
  );

  return { currency, formatPrice };
}
