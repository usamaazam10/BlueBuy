/**
 * Category service — placeholder.
 *
 * Defines the intended data-access surface for the `categories` collection.
 * Every method currently throws `notImplemented`. Firestore queries and writes
 * are intentionally NOT implemented in this phase.
 */
import { notImplemented } from '@/firebase';
import type { Category } from '@/types/models';
import type { CategoryCreateInput, CategoryUpdateInput } from '@/lib/validations';

export interface ListCategoriesOptions {
  parentId?: string | null;
  activeOnly?: boolean;
}

export const categoryService = {
  /** List categories, optionally filtered by parent for tree building. */
  async list(_options?: ListCategoriesOptions): Promise<Category[]> {
    throw notImplemented('categoryService.list');
  },

  /** Fetch a single category by document id. */
  async getById(_id: string): Promise<Category | null> {
    throw notImplemented('categoryService.getById');
  },

  /** Fetch a single category by its slug. */
  async getBySlug(_slug: string): Promise<Category | null> {
    throw notImplemented('categoryService.getBySlug');
  },

  /** Create a category (validates with categoryCreateSchema). */
  async create(_input: CategoryCreateInput): Promise<Category> {
    throw notImplemented('categoryService.create');
  },

  /** Update an existing category. */
  async update(_id: string, _input: CategoryUpdateInput): Promise<Category> {
    throw notImplemented('categoryService.update');
  },

  /** Delete (or soft-delete) a category. */
  async remove(_id: string): Promise<void> {
    throw notImplemented('categoryService.remove');
  },
};

export type CategoryService = typeof categoryService;
