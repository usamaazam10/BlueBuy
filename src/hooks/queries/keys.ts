/**
 * Centralised React Query keys for the storefront catalogue.
 *
 * Keep every key here so cache reads, invalidations and prefetches all refer to
 * the same tuples. Add new keys alongside these as new queries are introduced.
 */
export const queryKeys = {
  products: ['products'] as const,
  allProducts: ['products', 'all'] as const,
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

  // ── Business operations ──
  // Range-scoped keys take a stable string token (see `rangeToken`) so two
  // components asking for the same period share one cache entry, and changing
  // the period refetches instead of silently reusing the wrong window.
  suppliers: ['suppliers'] as const,
  supplier: (id: string) => ['suppliers', id] as const,

  purchaseOrders: (range: string) => ['purchase_orders', range] as const,
  purchaseOrder: (id: string) => ['purchase_orders', 'detail', id] as const,
  purchaseReceipts: (range: string) => ['purchase_receipts', range] as const,
  purchaseReceiptsFor: (id: string) => ['purchase_receipts', 'for', id] as const,
  purchasePayments: (id: string) => ['purchase_payments', id] as const,

  inventoryMovements: (range: string) => ['inventory_movements', range] as const,
  productMovements: (productId: string) => ['inventory_movements', 'product', productId] as const,

  expenses: (range: string) => ['expenses', range] as const,
  expenseCategories: ['expense_categories'] as const,
  cashTransactions: (range: string) => ['cash_transactions', range] as const,
  cashLedger: ['cash_transactions', 'all'] as const,
  orderPayments: (id: string) => ['order_payments', id] as const,

  auditLogs: (range: string) => ['audit_logs', range] as const,
  auditLogsFor: (entity: string, id: string) => ['audit_logs', entity, id] as const,
};

/**
 * Stable cache token for a date range.
 *
 * Uses epoch millis rather than the `Date` objects themselves: React Query
 * hashes keys structurally, and two `Date` instances for the same instant are
 * not interchangeable in every code path. A primitive keeps the key predictable.
 */
export function rangeToken(range: { start: Date; end: Date } | null | undefined): string {
  if (!range) return 'all';
  return `${range.start.getTime()}-${range.end.getTime()}`;
}
