/**
 * Shopping cart domain types.
 *
 * The cart is deliberately decoupled from the catalogue: a {@link CartItem} is a
 * self-contained *snapshot* of a product taken at add-time (title, unit price,
 * image, stock cap). That means the cart renders and totals correctly from
 * localStorage alone — no products query has to resolve first — and a later
 * catalogue change never silently mutates what the shopper already added.
 *
 * Pricing is intentionally layered and pluggable. The pure engine in
 * `@/lib/cart/pricing` turns `CartItem[]` + a {@link PricingConfig} into
 * {@link CartTotals}. Discounts, shipping and tax are all optional config today
 * (checkout isn't built yet) but the shapes and math are already in place, so
 * enabling any of them is a config change, not a rewrite.
 */

/** A single line in the cart — one entry per product id. */
export interface CartItem {
  /** Product id. Doubles as the unique line key (quantity holds the count). */
  id: string;
  slug: string;
  title: string;
  /** Unit price captured when the item was added. */
  unitPrice: number;
  /** Original price for strike-through display, when the product was on sale. */
  compareAtPrice?: number;
  /** Thumbnail URL; absent items fall back to the deterministic SVG placeholder. */
  image?: string;
  /** Accent hex driving the placeholder art when there's no image. */
  accent: string;
  /** ISO 4217 code, e.g. "USD". */
  currency: string;
  /** Stock cap captured at add-time; quantity is clamped to this. */
  maxQuantity: number;
  quantity: number;
}

/**
 * The minimal product shape the cart needs to add a line. `StoreProduct`
 * satisfies this structurally, so any catalogue product can be added directly.
 */
export interface CartAddable {
  id: string;
  slug: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  thumbnail?: string;
  accent: string;
  currency?: string;
  stock: number;
}

export type DiscountType = 'percentage' | 'fixed';

/** A promotional discount applied to the subtotal. */
export interface Discount {
  code: string;
  label: string;
  type: DiscountType;
  /** Percentage discounts use 0–100; fixed discounts use a currency amount. */
  value: number;
}

/** Shipping strategy for the cart. */
export interface ShippingRule {
  label: string;
  /** Flat fee applied when the order doesn't qualify for free shipping. */
  flatRate: number;
  /** Discounted subtotal at/above which shipping becomes free. */
  freeThreshold?: number;
}

/** Tax strategy for the cart. */
export interface TaxConfig {
  label: string;
  /** Fractional rate, e.g. 0.08 for 8%. */
  rate: number;
  /** When true, prices already include tax (shown for info, not added on top). */
  inclusive: boolean;
}

/**
 * Pluggable pricing configuration. Any field left `null` is simply skipped by
 * the engine — that's how the cart currently ships subtotal-only while staying
 * fully discount-, shipping- and tax-ready.
 */
export interface PricingConfig {
  discount: Discount | null;
  shipping: ShippingRule | null;
  tax: TaxConfig | null;
}

/** Fully-computed money breakdown for a cart. All amounts are in `currency`. */
export interface CartTotals {
  /** Total number of units across all lines. */
  itemCount: number;
  /** Sum of unitPrice × quantity across lines, before any adjustments. */
  subtotal: number;
  /** Amount subtracted by the active discount (>= 0). */
  discount: number;
  discountLabel: string | null;
  /** Shipping charge added (0 when free or unconfigured). */
  shipping: number;
  shippingLabel: string | null;
  /** True when a shipping rule applied and resolved to free. */
  freeShipping: boolean;
  /** Tax added on top (0 for inclusive or unconfigured tax). */
  tax: number;
  taxLabel: string | null;
  /** Grand total the shopper pays. */
  total: number;
  currency: string;
}
