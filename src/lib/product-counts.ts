/**
 * Live product counts, grouped by category/brand id.
 *
 * The `Category.productCount` field in Firestore is a denormalised hint that can
 * drift (there is no server to keep it in sync on a static export). For anything
 * user-facing — the admin managers, storefront category/brand chips, and the
 * category/brand delete-safety guard — we compute counts directly from the live
 * product list instead, so the numbers are always correct and never require an
 * extra write. Pass in whichever list is appropriate: all products (admin,
 * delete guard) or active-only products (storefront display).
 */

interface CountableProduct {
  categoryId: string;
  brandId: string;
}

/** Counts of products grouped by a chosen id field. */
export function countBy<T extends CountableProduct>(
  products: T[],
  field: 'categoryId' | 'brandId'
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const product of products) {
    const key = product[field];
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Both category and brand counts from one pass over the product list. */
export interface ProductCounts {
  byCategory: Map<string, number>;
  byBrand: Map<string, number>;
  total: number;
}

export function computeProductCounts<T extends CountableProduct>(products: T[]): ProductCounts {
  return {
    byCategory: countBy(products, 'categoryId'),
    byBrand: countBy(products, 'brandId'),
    total: products.length,
  };
}
