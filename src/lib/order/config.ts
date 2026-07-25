/**
 * Checkout pricing configuration.
 *
 * The cart ships subtotal-only (see `@/lib/cart/config`); shipping and any
 * promotional discount are resolved *at checkout* using this config, fed
 * through the same pure pricing engine (`@/lib/cart/pricing`). Keeping it here
 * means the money math an order stores is identical to what the customer sees
 * on the checkout summary — one engine, one config, no drift.
 *
 * Adjust these values (or wire them to env/remote config) to change shipping or
 * introduce a discount without touching any component or service code.
 */
import type { PricingConfig } from '@/types/cart';

/** Flat shipping fee applied below the free-shipping threshold. */
export const SHIPPING_FLAT_RATE = 6.95;
/** Discounted subtotal at/above which shipping is free. */
export const FREE_SHIPPING_THRESHOLD = 75;

/**
 * Pricing rules applied on the checkout page and stored on the order.
 * Tax is intentionally left off (this flow is cash-on-delivery / manual
 * fulfilment); enable it here later if needed — the engine already supports it.
 */
export const CHECKOUT_PRICING_CONFIG: PricingConfig = {
  discount: null,
  shipping: {
    label: 'Shipping',
    flatRate: SHIPPING_FLAT_RATE,
    freeThreshold: FREE_SHIPPING_THRESHOLD,
  },
  tax: null,
};

/** Estimated processing/dispatch window shown on the success screen. */
export const ESTIMATED_PROCESSING = '1–2 business days';
