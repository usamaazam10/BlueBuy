/**
 * Checkout pricing configuration.
 *
 * The cart ships subtotal-only (see `@/lib/cart/config`); anything added on top
 * is resolved *at checkout* using this config, fed through the same pure pricing
 * engine (`@/lib/cart/pricing`). Keeping it here means the money math an order
 * stores is identical to what the customer sees on the checkout summary — one
 * engine, one config, no drift.
 *
 * **Shipping is deliberately off.** It used to be a flat 6.95 with free delivery
 * over 75 — figures inherited from the demo build, denominated in nothing in
 * particular. Against a PKR catalogue every order cleared that threshold, so the
 * summary advertised "Shipping: Free" on every single order: a delivery promise
 * BlueBuy never made. Orders are confirmed with the customer directly, so the
 * checkout now adds nothing to the subtotal and states that delivery is
 * confirmed on that call instead.
 *
 * To charge shipping for real, set `shipping` below to
 * `{ label: 'Shipping', flatRate: <amount>, freeThreshold: <amount> }` in the
 * store's own currency — the engine already supports it, and the checkout
 * summary will render the row automatically.
 */
import type { PricingConfig } from '@/types/cart';

/**
 * Pricing rules applied on the checkout page and stored on the order.
 * Tax is intentionally left off (this flow is cash-on-delivery / manual
 * fulfilment); enable it here later if needed — the engine already supports it.
 */
export const CHECKOUT_PRICING_CONFIG: PricingConfig = {
  discount: null,
  shipping: null,
  tax: null,
};
