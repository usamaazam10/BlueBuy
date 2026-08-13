/**
 * Small presentational product types shared by the storefront view models.
 *
 * The catalogue itself lives in Firestore (`@/types/models`) and reaches the UI
 * as `StoreProduct` (`@/types/store`); these are the two display-only shapes
 * that view model reuses.
 */

/** The badge shown on a product card, derived from real product state. */
export type ProductBadge = 'New' | 'Sale' | 'Featured' | 'Limited';

/** One row of a product's specification table. */
export interface ProductSpec {
  label: string;
  value: string;
}
