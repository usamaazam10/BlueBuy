/**
 * CategoryRepository — the single gateway to the `categories` Firestore
 * collection for storefront reads.
 *
 * Mirrors {@link ProductRepository}: components never touch Firestore directly,
 * every read is normalised to an `AppError`, and storefront listing uses a
 * single `where('active','==',true)` with no `orderBy` so it stays on an
 * automatic single-field index (no composite index to deploy). Display ordering
 * (`sortOrder`) is applied client-side.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS, type Category } from '@/types/models';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from '@/lib/validations';

/** Firestore collection reference for categories. */
function categoriesCollection() {
  return collection(getDb(), COLLECTIONS.categories);
}

/** Map a Firestore snapshot into a typed `Category` (doc id + data). */
function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Category {
  const data = snapshot.data();
  return { ...(data as Omit<Category, 'id'>), id: snapshot.id };
}

export const CategoryRepository = {
  /** List active categories (unordered; sort client-side by `sortOrder`). */
  async listActive(): Promise<Category[]> {
    return withAppError(async () => {
      const snap = await getDocs(query(categoriesCollection(), where('active', '==', true)));
      return snap.docs.map(fromSnapshot);
    }, 'list categories');
  },

  /** Fetch a single category by document id, or `null` if it doesn't exist. */
  async getById(id: string): Promise<Category | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), COLLECTIONS.categories, id));
      return snapshot.exists() ? fromSnapshot(snapshot) : null;
    }, 'load category');
  },

  /** Fetch a single category by slug, or `null` if none matches. */
  async getBySlug(slug: string): Promise<Category | null> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(categoriesCollection(), where('slug', '==', slug), limit(1))
      );
      return snap.empty ? null : fromSnapshot(snap.docs[0]);
    }, 'load category');
  },

  /**
   * List every category (active and inactive) for the admin. Unordered — the
   * admin sorts client-side — so it stays on the automatic index.
   */
  async list(): Promise<Category[]> {
    return withAppError(async () => {
      const snap = await getDocs(categoriesCollection());
      return snap.docs.map(fromSnapshot);
    }, 'list categories');
  },

  /**
   * Whether a slug is already taken. Pass `excludeId` when editing so a category
   * keeping its own slug isn't flagged as a duplicate of itself.
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(categoriesCollection(), where('slug', '==', slug), limit(1))
      );
      if (snap.empty) return false;
      return snap.docs[0].id !== excludeId;
    }, 'check slug');
  },

  /** Create a category. Validates the payload and rejects a duplicate slug. */
  async create(input: CategoryCreateInput): Promise<Category> {
    const data = categoryCreateSchema.parse(input);

    if (await this.slugExists(data.slug)) {
      throw new AppError('already-exists', `The slug "${data.slug}" is already in use.`);
    }

    return withAppError(async () => {
      const ref = await addDoc(categoriesCollection(), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot(created as QueryDocumentSnapshot<DocumentData>);
    }, 'create category');
  },

  /** Update a category. Validates the partial payload; rejects a slug collision. */
  async update(id: string, input: CategoryUpdateInput): Promise<Category> {
    const data = categoryUpdateSchema.parse(input);

    if (data.slug && (await this.slugExists(data.slug, id))) {
      throw new AppError('already-exists', `The slug "${data.slug}" is already in use.`);
    }

    return withAppError(async () => {
      const ref = doc(getDb(), COLLECTIONS.categories, id);
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'The category no longer exists.');
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'update category');
  },

  /** Delete a category document. */
  async remove(id: string): Promise<void> {
    return withAppError(async () => {
      await deleteDoc(doc(getDb(), COLLECTIONS.categories, id));
    }, 'delete category');
  },
};

export type CategoryRepositoryType = typeof CategoryRepository;
