/**
 * Shared, app-wide TypeScript types.
 *
 * Feature-specific types should live alongside their feature in
 * `features/<feature>/types.ts`. Keep this file for cross-cutting contracts.
 */

/** Utility: make a type explicitly nullable. */
export type Nullable<T> = T | null;

export type { Product, ProductBadge, ProductSpec, Category } from './product';
