/**
 * BrandRepository — the single gateway to the `brands` Firestore collection for
 * storefront reads.
 *
 * Mirrors {@link ProductRepository}: components never touch Firestore directly,
 * every read is normalised to an `AppError`, and storefront listing uses a
 * single `where('active','==',true)` with no `orderBy` (automatic single-field
 * index, no composite index to deploy). Display ordering is applied client-side.
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
import { COLLECTIONS, type Brand } from '@/types/models';

/** Firestore collection reference for brands. */
function brandsCollection() {
  return collection(getDb(), COLLECTIONS.brands);
}

/** Map a Firestore snapshot into a typed `Brand` (doc id + data). */
function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Brand {
  const data = snapshot.data();
  return { ...(data as Omit<Brand, 'id'>), id: snapshot.id };
}

export const BrandRepository = {
  /** List active brands (unordered; sort client-side by `name`). */
  async listActive(): Promise<Brand[]> {
    return withAppError(async () => {
      const snap = await getDocs(query(brandsCollection(), where('active', '==', true)));
      return snap.docs.map(fromSnapshot);
    }, 'list brands');
  },

  /** Fetch a single brand by document id, or `null` if it doesn't exist. */
  async getById(id: string): Promise<Brand | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), COLLECTIONS.brands, id));
      return snapshot.exists() ? fromSnapshot(snapshot) : null;
    }, 'load brand');
  },

  /** Fetch a single brand by slug, or `null` if none matches. */
  async getBySlug(slug: string): Promise<Brand | null> {
    return withAppError(async () => {
      const snap = await getDocs(query(brandsCollection(), where('slug', '==', slug), limit(1)));
      return snap.empty ? null : fromSnapshot(snap.docs[0]);
    }, 'load brand');
  },
};

export type BrandRepositoryType = typeof BrandRepository;
