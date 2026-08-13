/**
 * The BlueBuy Collection — BlueBuy's own product line.
 *
 * Not every product BlueBuy sells carries a well-known consumer brand: many are
 * sourced directly, from local or OEM suppliers, and are catalogued either with
 * no brand at all or under BlueBuy's own name. Rather than showing those with a
 * blank brand slot — or with the shop's name repeated as if it were a third-party
 * label — the storefront presents them as one named line: the BlueBuy Collection.
 *
 * Membership is derived from real catalogue data, never a per-product flag, so
 * it can't drift out of sync with Firestore. A product is in the collection when
 * it has **no brand**, or when its brand **is BlueBuy itself**.
 */
import type { StoreProduct } from '@/types/store';

/** Identity of the collection as it appears in URLs, filters and headings. */
export const BLUEBUY_COLLECTION = {
  /** Value used for the `?brand=` filter on `/products`. */
  slug: 'bluebuy-collection',
  name: 'BlueBuy Collection',
  description:
    'Products we source and offer directly under our own label — selected for quality, usefulness and value.',
} as const;

/** Case/spacing-insensitive key for comparing brand names ("Blue Buy" → "bluebuy"). */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Whether a brand is BlueBuy's own label rather than a third-party brand.
 * Matches however the brand happens to be spelled in the admin ("BlueBuy",
 * "Blue Buy", "blue-buy").
 */
export function isOwnLabelBrand(brandName: string): boolean {
  return normalizeName(brandName) === 'bluebuy';
}

/** Whether a product belongs to the BlueBuy Collection. */
export function isCollectionProduct(product: Pick<StoreProduct, 'brandId' | 'brandName'>): boolean {
  return !product.brandId || isOwnLabelBrand(product.brandName);
}

/**
 * The brand label to display for a product — its real third-party brand, or the
 * BlueBuy Collection for anything we source ourselves.
 */
export function productBrandLabel(product: Pick<StoreProduct, 'brandId' | 'brandName'>): string {
  return isCollectionProduct(product) ? BLUEBUY_COLLECTION.name : product.brandName;
}
