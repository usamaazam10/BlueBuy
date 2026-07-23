import { PRODUCTS } from '@/data/products';
import type { AdminProduct, ProductStatus } from './types';

/** Maps a storefront category slug to the owning mock brand id. */
const CATEGORY_TO_BRAND: Record<string, string> = {
  audio: 'brand-aura',
  wearables: 'brand-vertex',
  displays: 'brand-lumen',
  accessories: 'brand-cobalt',
  'smart-home': 'brand-beacon',
  cameras: 'brand-frame',
};

/** A couple of slugs are surfaced as non-active to exercise every status pill. */
const STATUS_OVERRIDES: Record<string, ProductStatus> = {
  'glide-wireless-mouse': 'draft',
  'pocket-action-cam': 'draft',
  'frame-mirrorless-camera': 'archived',
};

/** Deterministic "days ago" so updatedAt is stable across renders/SSR. */
function daysAgoISO(days: number): string {
  const base = Date.UTC(2026, 6, 23); // 2026-07-23, the catalogue snapshot date
  return new Date(base - days * 86_400_000).toISOString();
}

/**
 * Admin product records derived from the storefront catalogue and augmented
 * with the fields the admin manages (brand, status, featured, updatedAt).
 * This is a separate array, so table edits in the UI never touch storefront data.
 */
export const ADMIN_PRODUCTS: AdminProduct[] = PRODUCTS.map((product, index) => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  category: product.category,
  brandId: CATEGORY_TO_BRAND[product.category] ?? 'brand-aura',
  price: product.price,
  compareAtPrice: product.compareAtPrice,
  stock: product.stock,
  status: STATUS_OVERRIDES[product.slug] ?? 'active',
  featured: index < 4,
  accent: product.accent,
  images: product.images,
  updatedAt: daysAgoISO(index * 2 + 1),
}));

export function getAdminProductById(id: string): AdminProduct | undefined {
  return ADMIN_PRODUCTS.find((product) => product.id === id);
}

/** Low-stock threshold used for the "Low stock" badge and dashboard stat. */
export const LOW_STOCK_THRESHOLD = 10;
