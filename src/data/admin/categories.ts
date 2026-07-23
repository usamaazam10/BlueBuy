import { CATEGORIES } from '@/data/categories';
import type { AdminCategory } from './types';

/**
 * Admin categories, derived from the storefront category list and enriched with
 * the `active` flag the admin exposes. Kept as its own array so editing here in
 * the UI never mutates storefront data.
 */
export const ADMIN_CATEGORIES: AdminCategory[] = CATEGORIES.map((category) => ({
  id: category.id,
  slug: category.slug,
  name: category.name,
  description: category.description,
  accent: category.accent,
  productCount: category.count,
  active: true,
}));

export function getAdminCategoryBySlug(slug: string): AdminCategory | undefined {
  return ADMIN_CATEGORIES.find((category) => category.slug === slug);
}
