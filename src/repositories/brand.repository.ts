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
import { COLLECTIONS, type Brand } from '@/types/models';
import {
  brandCreateSchema,
  brandUpdateSchema,
  type BrandCreateInput,
  type BrandUpdateInput,
} from '@/lib/validations';

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

  /**
   * List every brand (active and inactive) for the admin. Unordered — the admin
   * sorts client-side — so it stays on the automatic index.
   */
  async list(): Promise<Brand[]> {
    return withAppError(async () => {
      const snap = await getDocs(brandsCollection());
      return snap.docs.map(fromSnapshot);
    }, 'list brands');
  },

  /**
   * Whether a slug is already taken. Pass `excludeId` when editing so a brand
   * keeping its own slug isn't flagged as a duplicate of itself.
   */
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return withAppError(async () => {
      const snap = await getDocs(query(brandsCollection(), where('slug', '==', slug), limit(1)));
      if (snap.empty) return false;
      return snap.docs[0].id !== excludeId;
    }, 'check slug');
  },

  /** Create a brand. Validates the payload and rejects a duplicate slug. */
  async create(input: BrandCreateInput): Promise<Brand> {
    const data = brandCreateSchema.parse(input);

    if (await this.slugExists(data.slug)) {
      throw new AppError('already-exists', `The slug "${data.slug}" is already in use.`);
    }

    return withAppError(async () => {
      const ref = await addDoc(brandsCollection(), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot(created as QueryDocumentSnapshot<DocumentData>);
    }, 'create brand');
  },

  /** Update a brand. Validates the partial payload; rejects a slug collision. */
  async update(id: string, input: BrandUpdateInput): Promise<Brand> {
    const data = brandUpdateSchema.parse(input);

    if (data.slug && (await this.slugExists(data.slug, id))) {
      throw new AppError('already-exists', `The slug "${data.slug}" is already in use.`);
    }

    return withAppError(async () => {
      const ref = doc(getDb(), COLLECTIONS.brands, id);
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'The brand no longer exists.');
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'update brand');
  },

  /** Delete a brand document. */
  async remove(id: string): Promise<void> {
    return withAppError(async () => {
      await deleteDoc(doc(getDb(), COLLECTIONS.brands, id));
    }, 'delete brand');
  },
};

export type BrandRepositoryType = typeof BrandRepository;
