/**
 * Centralised React Query keys for the storefront catalogue.
 *
 * Keep every key here so cache reads, invalidations and prefetches all refer to
 * the same tuples. Add new keys alongside these as new queries are introduced.
 */
export const queryKeys = {
  products: ['products'] as const,
  categories: ['categories'] as const,
  brands: ['brands'] as const,
  product: (slug: string) => ['product', slug] as const,
};
