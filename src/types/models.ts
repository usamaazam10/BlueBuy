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
  /** Optional Storage/URL image for the category. */
  image: string | null;
  /** Reference → categories.id for nesting; null for a top-level category. */
  parentId: string | null;
  /** Denormalised count of active products in this category. */
  productCount: number;
  /** Display ordering (ascending). */
  sortOrder: number;
  active: boolean;
}

/** Brand document — collection: `brands`. */
export interface Brand extends BaseDocument {
  slug: string;
  name: string;
  description: string;
  /** Brand logo URL, if any. */
  logo: string | null;
  website: string | null;
  active: boolean;
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
