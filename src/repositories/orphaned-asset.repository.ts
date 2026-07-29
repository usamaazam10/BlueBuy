/**
 * OrphanedAssetRepository — the single gateway to the `orphaned_assets`
 * Firestore collection.
 *
 * Mirrors the other repositories: components never touch Firestore directly,
 * writes are validated with the shared Zod schema, and every error is normalised
 * to an `AppError`. This collection is the cleanup ledger described on the
 * {@link OrphanedAsset} model — it lets the admin reconcile Cloudinary assets
 * that the static client cannot delete itself (no API secret, no server).
 *
 * Reads are unordered (single automatic index) and sorted client-side.
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, withAppError } from '@/firebase';
import { COLLECTIONS, type OrphanedAsset } from '@/types/models';
import { orphanedAssetCreateSchema, type OrphanedAssetCreateInput } from '@/lib/validations';

/** Firestore collection reference for orphaned assets. */
function orphanedAssetsCollection() {
  return collection(getDb(), COLLECTIONS.orphanedAssets);
}

/** Map a Firestore snapshot into a typed `OrphanedAsset` (doc id + data). */
function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): OrphanedAsset {
  const data = snapshot.data();
  return { ...(data as Omit<OrphanedAsset, 'id'>), id: snapshot.id };
}

export const OrphanedAssetRepository = {
  /**
   * Record one or more orphaned assets. Each entry is validated before write.
   * Best-effort per-entry: a malformed entry is skipped rather than failing the
   * whole batch, so a delete flow is never blocked by ledger bookkeeping.
   */
  async record(inputs: OrphanedAssetCreateInput[]): Promise<void> {
    if (inputs.length === 0) return;
    return withAppError(async () => {
      await Promise.all(
        inputs.map(async (input) => {
          const parsed = orphanedAssetCreateSchema.safeParse(input);
          if (!parsed.success) return;
          await addDoc(orphanedAssetsCollection(), {
            ...parsed.data,
            cleanedAt: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        })
      );
    }, 'record orphaned assets');
  },

  /** List every recorded asset (pending and cleaned). Sort client-side. */
  async list(): Promise<OrphanedAsset[]> {
    return withAppError(async () => {
      const snap = await getDocs(orphanedAssetsCollection());
      return snap.docs.map(fromSnapshot);
    }, 'list orphaned assets');
  },

  /** Mark an asset as cleaned (operator has destroyed it in Cloudinary). */
  async markCleaned(id: string, cleaned = true): Promise<void> {
    return withAppError(async () => {
      await updateDoc(doc(getDb(), COLLECTIONS.orphanedAssets, id), {
        cleaned,
        cleanedAt: cleaned ? serverTimestamp() : null,
        updatedAt: serverTimestamp(),
      });
    }, 'update orphaned asset');
  },

  /** Permanently remove a ledger entry. */
  async remove(id: string): Promise<void> {
    return withAppError(async () => {
      await deleteDoc(doc(getDb(), COLLECTIONS.orphanedAssets, id));
    }, 'delete orphaned asset');
  },
};

export type OrphanedAssetRepositoryType = typeof OrphanedAssetRepository;
