/**
 * Product service — placeholder.
 *
 * Defines the intended data-access surface for the `products` collection.
 * Every method currently throws `notImplemented` (an AppError). Firestore
 * queries and writes are intentionally NOT implemented in this phase.
 *
 * When implemented, methods should use `getDb()` from `@/firebase` and validate
 * inputs with the schemas in `@/lib/validations`.
 */
import { notImplemented } from '@/firebase';
import type { Product } from '@/types/models';
import type { ProductCreateInput, ProductUpdateInput } from '@/lib/validations';

export interface ListProductsOptions {
  categoryId?: string;
  brandId?: string;
  featured?: boolean;
  activeOnly?: boolean;
  pageSize?: number;
  cursor?: string;
}

export const productService = {
  /** List products with optional filters/pagination. */
  async list(_options?: ListProductsOptions): Promise<Product[]> {
    throw notImplemented('productService.list');
  },

  /** Fetch a single product by document id. */
  async getById(_id: string): Promise<Product | null> {
    throw notImplemented('productService.getById');
  },

  /** Fetch a single product by its slug. */
  async getBySlug(_slug: string): Promise<Product | null> {
    throw notImplemented('productService.getBySlug');
  },

  /** Fetch featured products for the homepage. */
  async getFeatured(_limit?: number): Promise<Product[]> {
    throw notImplemented('productService.getFeatured');
  },

  /** Create a product (validates with productCreateSchema). */
  async create(_input: ProductCreateInput): Promise<Product> {
    throw notImplemented('productService.create');
  },

  /** Update an existing product. */
  async update(_id: string, _input: ProductUpdateInput): Promise<Product> {
    throw notImplemented('productService.update');
  },

  /** Delete (or soft-delete) a product. */
  async remove(_id: string): Promise<void> {
    throw notImplemented('productService.remove');
  },
};

export type ProductService = typeof productService;
