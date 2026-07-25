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
  orders: ['orders'] as const,
  order: (id: string) => ['order', id] as const,

  // CMS content
  siteSettings: ['cms', 'site_settings'] as const,
  homepage: ['cms', 'homepage'] as const,
  footer: ['cms', 'footer'] as const,
  contactInformation: ['cms', 'contact_information'] as const,
  navigation: ['cms', 'navigation'] as const,
  banners: ['cms', 'banners'] as const,
  socialLinks: ['cms', 'social_links'] as const,
};
