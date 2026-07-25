/**
 * Pure cart pricing engine.
 *
 * Every money value the cart shows flows through {@link calculateTotals}. It is
 * intentionally side-effect free and framework-agnostic so it can be unit
 * tested, reused on a future server, and reasoned about in isolation.
 *
 * Order of operations (the conventional retail sequence):
 *   subtotal → discount → shipping (on the discounted subtotal) → tax → total
 */
import type { CartItem, CartTotals, Discount, PricingConfig, ShippingRule } from '@/types/cart';

/** Round to whole cents to avoid floating-point drift in displayed totals. */
function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Line total for a single cart item (unit price × quantity). */
export function lineSubtotal(item: CartItem): number {
  return round(item.unitPrice * item.quantity);
}

/** Total units across the cart (used for the nav badge and item count). */
export function countItems(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Resolve the discount amount for a given (pre-discount) subtotal. */
function resolveDiscount(discount: Discount, subtotal: number): number {
  const raw = discount.type === 'percentage' ? subtotal * (discount.value / 100) : discount.value;
  // Never discount below zero.
  return round(Math.min(Math.max(raw, 0), subtotal));
}

/** Resolve the shipping charge for a given (discounted) subtotal. */
function resolveShipping(
  shipping: ShippingRule,
  discountedSubtotal: number
): { amount: number; free: boolean } {
  const qualifiesFree =
    shipping.freeThreshold !== undefined && discountedSubtotal >= shipping.freeThreshold;
  if (qualifiesFree || shipping.flatRate <= 0) {
    return { amount: 0, free: true };
  }
  return { amount: round(shipping.flatRate), free: false };
}

/**
 * Compute the full money breakdown for a cart. Empty carts and `null` config
 * fields are handled gracefully — a missing discount/shipping/tax is simply
 * skipped, so the default (all-null) config yields `total === subtotal`.
 */
export function calculateTotals(items: CartItem[], config: PricingConfig): CartTotals {
  const currency = items[0]?.currency ?? 'USD';
  const subtotal = round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
  const itemCount = countItems(items);

  // Discount
  const discountAmount = config.discount ? resolveDiscount(config.discount, subtotal) : 0;
  const discountedSubtotal = round(subtotal - discountAmount);

  // Shipping (charged on the post-discount subtotal). No charge on an empty cart.
  let shipping = 0;
  let freeShipping = false;
  let shippingLabel: string | null = null;
  if (config.shipping && itemCount > 0) {
    const resolved = resolveShipping(config.shipping, discountedSubtotal);
    shipping = resolved.amount;
    freeShipping = resolved.free;
    shippingLabel = config.shipping.label;
  }

  // Tax (on the discounted subtotal; inclusive tax is informational only).
  let tax = 0;
  let taxLabel: string | null = null;
  if (config.tax && itemCount > 0) {
    taxLabel = config.tax.label;
    tax = config.tax.inclusive ? 0 : round(discountedSubtotal * config.tax.rate);
  }

  const total = round(discountedSubtotal + shipping + tax);

  return {
    itemCount,
    subtotal,
    discount: discountAmount,
    discountLabel: config.discount?.label ?? null,
    shipping,
    shippingLabel,
    freeShipping,
    tax,
    taxLabel,
    total,
    currency,
  };
}
