import type { StoreProduct } from '@/types/store';

/**
 * Whole-percent saving of a product on sale (`compareAtPrice` → `price`), or
 * `null` when it isn't discounted. Display-only — shared by every "deal"
 * surface so a badge can never disagree with the struck-through price.
 */
export function discountPercent(product: StoreProduct): number | null {
  const was = product.compareAtPrice;
  if (!was || was <= product.price) return null;
  const pct = Math.round(((was - product.price) / was) * 100);
  return pct > 0 ? pct : null;
}

/** In-stock products on sale, biggest saving first. */
export function pickDeals(products: readonly StoreProduct[], limit: number): StoreProduct[] {
  return products
    .filter((product) => product.stock > 0 && discountPercent(product) != null)
    .sort((a, b) => (discountPercent(b) ?? 0) - (discountPercent(a) ?? 0))
    .slice(0, limit);
}

/**
 * Products in the admin's curated order when `ids` resolves to any, otherwise
 * `featured`-flagged products backfilled with the rest.
 */
export function pickCurated(
  products: readonly StoreProduct[],
  ids: readonly string[],
  limit: number
): StoreProduct[] {
  if (ids.length > 0) {
    const byId = new Map(products.map((product) => [product.id, product]));
    const picked = ids
      .map((id) => byId.get(id))
      .filter((product): product is StoreProduct => product != null);
    if (picked.length > 0) return picked.slice(0, limit);
  }
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  return [...featured, ...rest].slice(0, limit);
}
