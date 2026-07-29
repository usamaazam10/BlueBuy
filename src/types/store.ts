/**
 * Storefront view models.
 *
 * These sit between the Firestore domain models (`@/types/models`) and the
 * public storefront UI. The Firestore shapes are write-oriented (ids, Cloudinary
 * metadata, timestamps); the components want display-ready values (a resolved
 * category name, a single current price, ready-to-render images). Mapping into
 * these types happens in exactly one place — `@/lib/mappers/store` — so the
 * repository stays UI-agnostic and the components stay declarative.
 *
 * Kept separate from the legacy mock UI types in `@/types/product` (which still
 * power the admin-derived mock data) so the two never clash.
 */
import type { ProductBadge, ProductSpec } from '@/types/product';

/** A ready-to-render product image (real Cloudinary URL + alt text). */
export interface StoreImage {
  url: string;
  alt: string;
  /** Cloudinary publicId for optimized/responsive delivery; undefined for legacy/thumbnail-only. */
  publicId?: string;
}

/** A product as the storefront consumes it. */
export interface StoreProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  /** Current price (the sale price when on sale, otherwise the base price). */
  price: number;
  /** Original price, shown struck-through when the product is on sale. */
  compareAtPrice?: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  rating: number;
  reviewCount: number;
  stock: number;
  /** Category display slug (used for the `?category=` filter + card label). */
  category: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  brandId: string;
  brandName: string;
  /** Brand logo URL (resolved from the brand doc), or null. */
  brandLogo: string | null;
  /** Brand logo Cloudinary publicId for optimized delivery, or null. */
  brandLogoPublicId: string | null;
  /** Ready-to-render gallery images; empty when the product has no media yet. */
  images: StoreImage[];
  /** Primary image URL, or empty string when there is no media. */
  thumbnail: string;
  badge?: ProductBadge;
  specs: ProductSpec[];
  highlights: string[];
  /** Derived accent (hex) that drives the SVG placeholder fallback. */
  accent: string;
  featured: boolean;
  /** `createdAt` in epoch millis (0 when pending) — used for the "Newest" sort. */
  createdAtMs: number;
  /** SEO fields, resolved with sensible fallbacks by the mapper. */
  seoTitle: string;
  seoDescription: string;
  metaKeywords: string[];
}

/** A category as the storefront consumes it (mirrors the legacy mock shape). */
export interface StoreCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  /** Cloudinary image URL, or null to fall back to the geometric accent tile. */
  image: string | null;
  /** Cloudinary publicId for building optimized/responsive URLs; null when none. */
  imagePublicId: string | null;
  /** Whether the category is promoted. */
  featured: boolean;
  /** Denormalised product count from Firestore (a hint; UI shows live counts). */
  count: number;
  sortOrder: number;
}

/** A brand as the storefront consumes it (for the products-page brand filter). */
export interface StoreBrand {
  id: string;
  slug: string;
  name: string;
  /** Cloudinary logo URL, or null to fall back to a text/geometric mark. */
  logo: string | null;
  /** Cloudinary publicId for building optimized/responsive URLs; null when none. */
  logoPublicId: string | null;
  /** Whether the brand is promoted. */
  featured: boolean;
  sortOrder: number;
}
