/**
 * Default cart pricing configuration.
 *
 * Checkout isn't built yet, so the shipping cost, tax and promotional discounts
 * are all resolved *at checkout* — this config leaves them `null`, which the
 * pricing engine treats as "skip", giving `total === subtotal` today.
 *
 * To turn any of these on later, flip the relevant field here (or pass a custom
 * config to `<CartProvider config={…}>`) — no component changes required. The
 * commented examples below show the exact shapes the engine already supports.
 */
import type { PricingConfig } from '@/types/cart';

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  // discount: { code: 'WELCOME10', label: 'Welcome 10% off', type: 'percentage', value: 10 },
  discount: null,

  // shipping: { label: 'Standard shipping', flatRate: 6.95, freeThreshold: 75 },
  shipping: null,

  // tax: { label: 'Estimated tax', rate: 0.08, inclusive: false },
  tax: null,
};
