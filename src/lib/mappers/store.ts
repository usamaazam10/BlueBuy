/**
 * Mapping from Firestore domain models (`@/types/models`) to storefront view
 * models (`@/types/store`).
 *
 * This is the *only* translation layer between persisted data and the public
 * UI. Firestore speaks ids, Cloudinary metadata and timestamps; the storefront
 * speaks resolved names, a single current price and ready-to-render images.
 * Keeping the conversion here means repositories stay UI-agnostic and the
 * product components stay declarative (they receive exactly what they render).
 */
import type { Brand, Category, FirestoreDate, Product, ProductImage } from '@/types/models';
import type { ProductBadge } from '@/types/product';
import type { StoreBrand, StoreCategory, StoreImage, StoreProduct } from '@/types/store';

/** Palette used to derive a stable accent when a product carries no colour. */
const ACCENT_PALETTE = [
  '#6366f1',
  '#0ea5e9',
  '#8b5cf6',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#10b981',
  '#a855f7',
];

/** Small deterministic string hash (matches the spirit of ProductMedia's hash). */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Deterministically derive an accent hex from any seed string. */
export function deriveAccent(seed: string): string {
  return ACCENT_PALETTE[hash(seed) % ACCENT_PALETTE.length];
}

/**
 * Humanise an id/slug into a display label — the graceful fallback when a
 * product's category/brand document can't be resolved (e.g. the collection is
 * empty or not yet readable). Strips a leading `cat-`/`category-`/`brand-`
 * prefix, turns separators into spaces and title-cases: `cat-audio` → `Audio`.
 */
export function humanizeId(value: string): string {
  return value
    .replace(/^(categories|category|cat|brands|brand)[-_]/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Convert a Firestore timestamp (Timestamp | Date | null) to epoch millis. */
function toMillis(value: FirestoreDate): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  // Firestore Timestamp exposes toMillis(); guard in case of a plain object.
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** Whether a product is currently on sale (has a lower, non-null sale price). */
function isOnSale(product: Product): boolean {
  return product.salePrice != null && product.salePrice < product.price;
}

/** Derive a display badge from the product's state, or undefined for none. */
function deriveBadge(product: Product, createdAtMs: number): ProductBadge | undefined {
  if (isOnSale(product)) return 'Sale';
  if (product.featured) return 'Bestseller';
  if (product.stock > 0 && product.stock <= 5) return 'Limited';
  // "New" = created within the last 30 days (when a timestamp is available).
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (createdAtMs > 0 && Date.now() - createdAtMs < THIRTY_DAYS) return 'New';
  return undefined;
}

/** Turn a stored gallery (or thumbnail fallback) into ready-to-render images. */
function toStoreImages(product: Product): StoreImage[] {
  if (product.gallery.length > 0) {
    return [...product.gallery]
      .sort((a: ProductImage, b: ProductImage) => a.sortOrder - b.sortOrder)
      .map((image) => ({ url: image.url, alt: image.alt || product.title }));
  }
  if (product.thumbnail) {
    return [{ url: product.thumbnail, alt: product.title }];
  }
  return [];
}

/** Lookup maps so a product's category/brand ids resolve to display names. */
export interface StoreLookups {
  categoryById: Map<string, Category>;
  brandById: Map<string, Brand>;
}

/** Build the id → doc lookup maps a batch of `toStoreProduct` calls needs. */
export function buildLookups(categories: Category[], brands: Brand[]): StoreLookups {
  return {
    categoryById: new Map(categories.map((category) => [category.id, category])),
    brandById: new Map(brands.map((brand) => [brand.id, brand])),
  };
}

/** Map a Firestore product into the storefront view model. */
export function toStoreProduct(product: Product, lookups: StoreLookups): StoreProduct {
  const category = lookups.categoryById.get(product.categoryId);
  const brand = lookups.brandById.get(product.brandId);
  const createdAtMs = toMillis(product.createdAt);
  const onSale = isOnSale(product);
  const categorySlug = category?.slug ?? product.categoryId;

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    shortDescription: product.shortDescription,
    price: onSale ? (product.salePrice as number) : product.price,
    compareAtPrice: onSale ? product.price : undefined,
    currency: product.currency || 'USD',
    rating: product.rating,
    reviewCount: product.reviewCount,
    stock: product.stock,
    category: categorySlug,
    categorySlug,
    categoryName: category?.name ?? humanizeId(categorySlug),
    brandId: product.brandId,
    brandName: brand?.name ?? (product.brandId ? humanizeId(product.brandId) : ''),
    images: toStoreImages(product),
    thumbnail: product.thumbnail || product.gallery[0]?.url || '',
    badge: deriveBadge(product, createdAtMs),
    specs: product.specifications.map((spec) => ({ label: spec.label, value: spec.value })),
    highlights: product.tags,
    accent: deriveAccent(product.id || product.slug),
    featured: product.featured,
    createdAtMs,
    seoTitle: product.seoTitle || product.title,
    seoDescription: product.seoDescription || product.shortDescription || product.description,
    metaKeywords: product.metaKeywords,
  };
}

/** Map + sort a batch of products into storefront view models (newest first). */
export function toStoreProducts(
  products: Product[],
  categories: Category[],
  brands: Brand[]
): StoreProduct[] {
  const lookups = buildLookups(categories, brands);
  return products
    .map((product) => toStoreProduct(product, lookups))
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

/** Map a Firestore category into the storefront view model. */
export function toStoreCategory(category: Category): StoreCategory {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
    accent: deriveAccent(category.id || category.slug),
    count: category.productCount,
    sortOrder: category.sortOrder,
  };
}

/** Map + sort categories for display (by `sortOrder`, then name). */
export function toStoreCategories(categories: Category[]): StoreCategory[] {
  return categories
    .map(toStoreCategory)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/** Map a Firestore brand into the storefront view model. */
export function toStoreBrand(brand: Brand): StoreBrand {
  return { id: brand.id, slug: brand.slug, name: brand.name };
}

/** Map + sort brands alphabetically for the products-page filter. */
export function toStoreBrands(brands: Brand[]): StoreBrand[] {
  return brands.map(toStoreBrand).sort((a, b) => a.name.localeCompare(b.name));
}
