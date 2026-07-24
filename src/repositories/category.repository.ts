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
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, withAppError } from '@/firebase';
import { COLLECTIONS, type Category } from '@/types/models';

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
};

export type CategoryRepositoryType = typeof CategoryRepository;
