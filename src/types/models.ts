/**
 * Firestore domain models for BlueBuy.
 *
 * These describe how documents are shaped **in the database**. They are kept
 * separate from the UI-facing types in `@/types/product` (which power the
 * current mock-data UI) so this Firebase foundation can evolve independently
 * without touching any existing pages or components.
 *
 * Import these from `@/types/models` (they are intentionally NOT re-exported
 * through `@/types` to avoid clashing with the UI `Product`/`Category` types).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Collection relationships (see COLLECTIONS below):
 *
 *   products.categoryId  ─▶ categories.id   (many products → one category)
 *   products.brandId     ─▶ brands.id       (many products → one brand)
 *   categories.parentId  ─▶ categories.id   (self-referential, optional tree)
 *   reviews.productId    ─▶ products.id     (many reviews → one product)
 *   cartItems.productId  ─▶ products.id     (cart references a product)
 *
 * Relationships are modelled by storing the related document **id** (a
 * reference by key), not by nesting documents. This keeps documents small,
 * write-friendly, and scalable — related data is fetched/joined on read.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { Timestamp } from 'firebase/firestore';

/** Canonical Firestore collection names. Use these instead of string literals. */
export const COLLECTIONS = {
  products: 'products',
  categories: 'categories',
  brands: 'brands',
  reviews: 'reviews',
  carts: 'carts',
  orders: 'orders',

  // ── CMS content (managed from the admin, rendered by the storefront) ──
  // Singleton documents (one doc per collection, id = "main"):
  siteSettings: 'site_settings',
  homepage: 'homepage',
  footer: 'footer',
  contactInformation: 'contact_information',
  // Item collections (many ordered documents):
  navigation: 'navigation',
  banners: 'banners',
  socialLinks: 'social_links',

  // ── Operations ──
  // Ledger of Cloudinary assets whose owning document was deleted (see below).
  orphanedAssets: 'orphaned_assets',

  // ── Business operations (see `@/types/business`) ──
  // Procurement:
  suppliers: 'suppliers',
  purchaseOrders: 'purchase_orders',
  purchaseReceipts: 'purchase_receipts',
  // Inventory ledger:
  inventoryMovements: 'inventory_movements',
  // Money:
  expenses: 'expenses',
  expenseCategories: 'expense_categories',
  cashTransactions: 'cash_transactions',
  // Storefront commerce analytics:
  analyticsEvents: 'analytics_events',
  analyticsDaily: 'analytics_daily',
  // Audit trail:
  auditLogs: 'audit_logs',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

/**
 * Firestore timestamps. `Timestamp` at rest; may surface as `Date` after
 * conversion or `null` for a pending server timestamp on a just-written doc.
 */
export type FirestoreDate = Timestamp | Date | null;

/** Fields present on every stored document. */
export interface BaseDocument {
  id: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
}

/**
 * A single product image, backed by Cloudinary.
 *
 * The fields mirror the metadata Cloudinary returns from an upload so an image
 * can be re-derived, transformed, or (via a backend) deleted later without a
 * second round-trip. Media is stored on Cloudinary — not Firebase Storage — so
 * there is no `storagePath`; `publicId` is the Cloudinary handle instead.
 */
export interface ProductImage {
  id: string;
  /** Cloudinary `secure_url` — the canonical HTTPS delivery URL. */
  url: string;
  /** Cloudinary `public_id` — required for transformations + future deletion. */
  publicId: string;
  /** Accessible alt text. */
  alt: string;
  /** Intrinsic width in pixels (Cloudinary `width`). */
  width: number;
  /** Intrinsic height in pixels (Cloudinary `height`). */
  height: number;
  /** Delivered format, e.g. `"jpg"`, `"png"`, `"webp"` (Cloudinary `format`). */
  format: string;
  /** File size in bytes (Cloudinary `bytes`). */
  bytes: number;
  /** Ordering within the gallery (ascending). */
  sortOrder: number;
  /** Whether this is the primary/hero image (mirrors {@link Product.thumbnail}). */
  isPrimary: boolean;
}

/** A single technical specification row shown on the product page. */
export interface ProductSpecification {
  label: string;
  value: string;
}

/** Product document — collection: `products`. */
export interface Product extends BaseDocument {
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  /** Base price in minor-safe major units (e.g. dollars). */
  price: number;
  /** Optional discounted price; when set and < price, the product is on sale. */
  salePrice: number | null;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  /** Reference → categories.id */
  categoryId: string;
  /** Reference → brands.id */
  brandId: string;
  /** Ordered gallery of Cloudinary-backed images. */
  gallery: ProductImage[];
  /** Convenience URL for list/card views (the primary gallery image). */
  thumbnail: string;
  /** Aggregate rating 0–5, denormalised for fast reads. */
  rating: number;
  /** Denormalised review count, kept in sync when reviews change. */
  reviewCount: number;
  stock: number;
  /**
   * Manually entered purchase cost, used as the cost basis until the product has
   * been received on a purchase order. `null` means "no cost recorded" — which
   * is reported as *insufficient cost data*, never as a cost of zero.
   *
   * Optional so documents written before the business-operations upgrade keep
   * validating; readers treat a missing field as `null` (see `costBasis()` in
   * `@/lib/business/costing`).
   */
  costPrice?: number | null;
  /**
   * Weighted-average unit cost, maintained by purchase receipts. This — not
   * {@link costPrice} — is the authoritative cost basis once goods have been
   * received. See `@/lib/business/costing` and BUSINESS_OPERATIONS.md § COGS.
   */
  averageCost?: number | null;
  /** Unit cost on the most recent receipt; informational only. */
  lastPurchaseCost?: number | null;
  /**
   * Stock level at which the product should be re-ordered. 0 disables it.
   *
   * NB: *reserved* and *available* quantities are deliberately NOT stored here.
   * Checkout decrements `stock` at order placement, so `stock` already IS the
   * available-to-sell figure; units committed to unshipped orders are derived
   * from those orders (see `reservedUnits` in `@/lib/business/inventory`).
   * Storing either would create a second source of truth that drifts.
   */
  reorderLevel?: number;
  /** Per-product low-stock threshold; falls back to `LOW_STOCK_THRESHOLD`. */
  lowStockThreshold?: number | null;
  /** Free-form tags for search/filtering. */
  tags: string[];
  /** Technical specification rows (label/value pairs). */
  specifications: ProductSpecification[];
  featured: boolean;
  /** Soft on/off switch; inactive products are hidden from storefront reads. */
  active: boolean;
  /** SEO — page title override; falls back to `title` when empty. */
  seoTitle: string;
  /** SEO — meta description; falls back to `shortDescription` when empty. */
  seoDescription: string;
  /** SEO — meta keywords. */
  metaKeywords: string[];
}

/** Category document — collection: `categories`. Supports an optional tree. */
export interface Category extends BaseDocument {
  slug: string;
  name: string;
  description: string;
  /** Cloudinary `secure_url` for the category image; null when none. */
  image: string | null;
  /** Cloudinary `public_id` of the image, kept so it can be recorded for cleanup on delete/replace. */
  imagePublicId: string | null;
  /** Reference → categories.id for nesting; null for a top-level category. */
  parentId: string | null;
  /** Denormalised count of active products in this category. Product counts shown in the UI are computed live from the catalogue (see `useProductCounts`); this field is a persisted hint only. */
  productCount: number;
  /** Whether the category is promoted (e.g. surfaced first on the storefront). */
  featured: boolean;
  /** Display ordering (ascending). */
  sortOrder: number;
  active: boolean;
  /** SEO — page title override; falls back to `name` when empty. */
  seoTitle: string;
  /** SEO — meta description; falls back to `description` when empty. */
  seoDescription: string;
  /** SEO — meta keywords. */
  metaKeywords: string[];
}

/** Brand document — collection: `brands`. */
export interface Brand extends BaseDocument {
  slug: string;
  name: string;
  description: string;
  /** Cloudinary `secure_url` for the brand logo; null when none. */
  logo: string | null;
  /** Cloudinary `public_id` of the logo, kept so it can be recorded for cleanup on delete/replace. */
  logoPublicId: string | null;
  website: string | null;
  /** Whether the brand is promoted (e.g. surfaced first on the storefront). */
  featured: boolean;
  /** Display ordering (ascending). */
  sortOrder: number;
  active: boolean;
  /** SEO — page title override; falls back to `name` when empty. */
  seoTitle: string;
  /** SEO — meta description; falls back to `description` when empty. */
  seoDescription: string;
  /** SEO — meta keywords. */
  metaKeywords: string[];
}

/**
 * Orphaned Cloudinary asset — collection: `orphaned_assets`.
 *
 * When a product/category/brand is deleted (or its image replaced), the app
 * removes the Firestore document but **cannot** delete the Cloudinary asset from
 * the browser: destroy requires a *signed* Admin API call using the API secret,
 * which must never ship to a static client. Instead, each affected `public_id`
 * is recorded here so an operator can reconcile Cloudinary from the admin
 * (copy the id, run a signed destroy via CLI/dashboard, then mark it cleaned).
 * This turns silent orphans into a visible, auditable cleanup queue.
 */
export interface OrphanedAsset extends BaseDocument {
  /** Cloudinary `public_id` to destroy. */
  publicId: string;
  /** Last known delivery URL, for a quick visual reference in the admin. */
  url: string;
  /** What kind of document the asset belonged to. */
  sourceType: 'product' | 'category' | 'brand';
  /** Id of the (now-deleted or edited) source document. */
  sourceId: string;
  /** Human-readable label of the source (e.g. the product title) for the admin list. */
  sourceLabel: string;
  /** True once an operator has destroyed the asset in Cloudinary. */
  cleaned: boolean;
  /** When it was marked cleaned; null while pending. */
  cleanedAt: FirestoreDate;
}

/** Review document — collection: `reviews`. */
export interface Review extends BaseDocument {
  /** Reference → products.id */
  productId: string;
  /** Reference → auth user uid (auth is initialise-only for now). */
  userId: string;
  authorName: string;
  /** Whole-star rating 1–5. */
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
}

/**
 * Cart line item. Carts are a per-user concern; the shape is defined here so
 * services/UI can share it later. Prices are snapshotted at add-time so a later
 * price change does not silently alter an existing cart.
 */
export interface CartItem {
  /** Reference → products.id */
  productId: string;
  slug: string;
  title: string;
  thumbnail: string;
  /** Price captured when the item was added to the cart. */
  unitPrice: number;
  currency: string;
  quantity: number;
  addedAt: FirestoreDate;
}

/** Helper: a model without its server-managed fields, for create payloads. */
export type CreateInput<T extends BaseDocument> = Omit<T, keyof BaseDocument>;

/** Helper: a partial update payload (server manages `updatedAt`). */
export type UpdateInput<T extends BaseDocument> = Partial<CreateInput<T>>;
