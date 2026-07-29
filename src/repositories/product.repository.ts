/**
 * ProductRepository — the single gateway to the `products` Firestore collection.
 *
 * Rules of the road:
 *  - **Components never touch Firestore directly.** They call this repository,
 *    which owns all reads/writes, validation, and error normalisation.
 *  - Inputs are validated with the shared Zod schemas in `@/lib/validations`, so
 *    invalid data (empty titles, negative prices, malformed slugs) can never
 *    reach the database regardless of the caller.
 *  - Slugs are unique. Create/update reject a slug already used by another doc.
 *  - Every thrown error is an `AppError` (see `@/firebase`) with a user-safe
 *    message, so the UI can surface failures consistently.
 *
 * Media note: images are uploaded to Cloudinary *before* they reach here (see
 * the Cloudinary service). This repository only persists the returned metadata.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS, type Product } from '@/types/models';
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '@/lib/validations';

/** Options for {@link ProductRepository.list}. */
export interface ListProductsOptions {
  categoryId?: string;
  brandId?: string;
  featured?: boolean;
  /** When true, only `active` products are returned. */
  activeOnly?: boolean;
  /** Max rows to fetch. */
  pageSize?: number;
}

/** Firestore collection reference for products. */
function productsCollection() {
  return collection(getDb(), COLLECTIONS.products);
}

/** Map a Firestore snapshot into a typed `Product` (doc id + data). */
function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Product {
  const data = snapshot.data();
  return { ...(data as Omit<Product, 'id'>), id: snapshot.id };
}

export const ProductRepository = {
  /**
   * Whether a slug is already taken. Pass `excludeId` when editing so a product
   * keeping its own slug isn't flagged as a duplicate of itself.
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return withAppError(async () => {
      const snap = await getDocs(query(productsCollection(), where('slug', '==', slug), limit(1)));
      if (snap.empty) return false;
      return snap.docs[0].id !== excludeId;
    }, 'check slug');
  },

  /** Fetch a single product by document id, or `null` if it doesn't exist. */
  async getById(id: string): Promise<Product | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), COLLECTIONS.products, id));
      return snapshot.exists() ? fromSnapshot(snapshot) : null;
    }, 'load product');
  },

  /** Fetch a single product by slug, or `null` if none matches. */
  async getBySlug(slug: string): Promise<Product | null> {
    return withAppError(async () => {
      const snap = await getDocs(query(productsCollection(), where('slug', '==', slug), limit(1)));
      return snap.empty ? null : fromSnapshot(snap.docs[0]);
    }, 'load product');
  },

  /**
   * List active products for the storefront.
   *
   * Deliberately applies a single `where('active','==',true)` and **no**
   * `orderBy` — this keeps the query on Firestore's automatic single-field index
   * (no composite index to deploy) and respects security rules that expose only
   * active documents. Sorting, filtering, search, "featured" and "related" are
   * all derived client-side from this one cached list (see `useStoreProducts`),
   * which the small catalogue makes both cheap and snappy.
   */
  async listActive(): Promise<Product[]> {
    return withAppError(async () => {
      const snap = await getDocs(query(productsCollection(), where('active', '==', true)));
      return snap.docs.map(fromSnapshot);
    }, 'list products');
  },

  /** List products, newest first, with optional filters. */
  async list(options: ListProductsOptions = {}): Promise<Product[]> {
    return withAppError(async () => {
      const constraints: QueryConstraint[] = [];
      if (options.categoryId) constraints.push(where('categoryId', '==', options.categoryId));
      if (options.brandId) constraints.push(where('brandId', '==', options.brandId));
      if (options.featured !== undefined)
        constraints.push(where('featured', '==', options.featured));
      if (options.activeOnly) constraints.push(where('active', '==', true));
      constraints.push(orderBy('createdAt', 'desc'));
      if (options.pageSize) constraints.push(limit(options.pageSize));

      const snap = await getDocs(query(productsCollection(), ...constraints));
      return snap.docs.map(fromSnapshot);
    }, 'list products');
  },

  /**
   * Count products referencing a category — used by the category delete-safety
   * guard so a category with assigned products can't be removed (which would
   * orphan those references). Counts ALL products (active + inactive), since an
   * inactive product still points at the category. Uses a server-side
   * aggregation (no docs transferred, stays on the automatic single-field index).
   */
  async countByCategory(categoryId: string): Promise<number> {
    return withAppError(async () => {
      const snap = await getCountFromServer(
        query(productsCollection(), where('categoryId', '==', categoryId))
      );
      return snap.data().count;
    }, 'count products');
  },

  /** Count products referencing a brand — brand delete-safety guard. */
  async countByBrand(brandId: string): Promise<number> {
    return withAppError(async () => {
      const snap = await getCountFromServer(
        query(productsCollection(), where('brandId', '==', brandId))
      );
      return snap.data().count;
    }, 'count products');
  },

  /**
   * Create a product. Validates the payload, rejects a duplicate slug, stamps
   * `createdAt`/`updatedAt` server-side, and returns the stored document.
   */
  async create(input: ProductCreateInput): Promise<Product> {
    // Validation is enforced here, not trusted from the caller.
    const data = productCreateSchema.parse(input);

    if (await this.slugExists(data.slug)) {
      throw new AppError('already-exists', `The slug "${data.slug}" is already in use.`);
    }

    return withAppError(async () => {
      const ref = await addDoc(productsCollection(), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot(created as QueryDocumentSnapshot<DocumentData>);
    }, 'create product');
  },

  /**
   * Update an existing product. Validates the partial payload; if the slug is
   * changing, rejects a collision with a *different* product. Bumps `updatedAt`.
   */
  async update(id: string, input: ProductUpdateInput): Promise<Product> {
    const data = productUpdateSchema.parse(input);

    if (data.slug && (await this.slugExists(data.slug, id))) {
      throw new AppError('already-exists', `The slug "${data.slug}" is already in use.`);
    }

    return withAppError(async () => {
      const ref = doc(getDb(), COLLECTIONS.products, id);
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'The product no longer exists.');
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'update product');
  },

  /**
   * Delete a product document (Firestore only).
   *
   * This removes the record but does NOT touch Cloudinary — secure deletion
   * needs a *signed* Admin API call using the API secret, which must never ship
   * to a static client. Callers that own Cloudinary media should delete via
   * `deleteProductWithImageCleanup` (see `@/services/image-cleanup.service`),
   * which records each image's `publicId` in the `orphaned_assets` ledger so an
   * operator can reconcile Cloudinary from `/admin/orphaned-assets`. See
   * PRODUCT_MANAGEMENT.md / CLOUDINARY.md.
   */
  async remove(id: string): Promise<void> {
    return withAppError(async () => {
      await deleteDoc(doc(getDb(), COLLECTIONS.products, id));
    }, 'delete product');
  },
};

export type ProductRepositoryType = typeof ProductRepository;
