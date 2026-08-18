/**
 * SupplierRepository — the only gateway to the `suppliers` collection.
 *
 * Suppliers are reference data for procurement: they carry no money of their
 * own, but purchase orders snapshot their name so history survives a rename or
 * deletion. Deleting a supplier is therefore safe for existing purchase
 * history — but is still blocked while purchase orders reference it, so the
 * admin can't lose the ability to look the supplier up.
 */
import {
  addDoc,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS } from '@/types/models';
import type { Supplier } from '@/types/business';
import {
  supplierCreateSchema,
  supplierUpdateSchema,
  type SupplierCreateInput,
  type SupplierUpdateInput,
} from '@/lib/validations';
import { collectionRef, fromSnapshot, pruneUndefined } from './shared';

const NAME = COLLECTIONS.suppliers;

export const SupplierRepository = {
  /** All suppliers, alphabetical. */
  async list(): Promise<Supplier[]> {
    return withAppError(async () => {
      const snap = await getDocs(query(collectionRef(NAME), orderBy('name', 'asc')));
      return snap.docs.map((d) => fromSnapshot<Supplier>(d));
    }, 'list suppliers');
  },

  /** Active suppliers only — what the purchase-order form offers. */
  async listActive(): Promise<Supplier[]> {
    return withAppError(async () => {
      // Single equality filter, no orderBy: stays on the automatic index and
      // needs no composite index deploy. Sorting happens client-side.
      const snap = await getDocs(query(collectionRef(NAME), where('active', '==', true)));
      return snap.docs
        .map((d) => fromSnapshot<Supplier>(d))
        .sort((a, b) => a.name.localeCompare(b.name));
    }, 'list suppliers');
  },

  async getById(id: string): Promise<Supplier | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), NAME, id));
      return snapshot.exists() ? fromSnapshot<Supplier>(snapshot) : null;
    }, 'load supplier');
  },

  async create(input: SupplierCreateInput): Promise<Supplier> {
    const data = supplierCreateSchema.parse(input);
    return withAppError(async () => {
      const ref = await addDoc(collectionRef(NAME), {
        ...pruneUndefined(data),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const created = await getDoc(ref);
      return fromSnapshot<Supplier>(created as QueryDocumentSnapshot<DocumentData>);
    }, 'create supplier');
  },

  async update(id: string, input: SupplierUpdateInput): Promise<Supplier> {
    const data = supplierUpdateSchema.parse(input);
    return withAppError(async () => {
      const ref = doc(getDb(), NAME, id);
      await updateDoc(ref, { ...pruneUndefined(data), updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'The supplier no longer exists.');
      return fromSnapshot<Supplier>(updated);
    }, 'update supplier');
  },

  /** Purchase orders referencing a supplier — the delete-safety guard. */
  async countPurchaseOrders(supplierId: string): Promise<number> {
    return withAppError(async () => {
      const snap = await getCountFromServer(
        query(collectionRef(COLLECTIONS.purchaseOrders), where('supplierId', '==', supplierId))
      );
      return snap.data().count;
    }, 'count purchase orders');
  },

  /**
   * Delete a supplier. Refuses while purchase orders reference it — accounting
   * history must stay navigable, so deactivate such suppliers instead.
   */
  async remove(id: string): Promise<void> {
    const referencing = await this.countPurchaseOrders(id);
    if (referencing > 0) {
      throw new AppError(
        'failed-precondition',
        `This supplier has ${referencing} purchase order${referencing === 1 ? '' : 's'}. Mark it inactive instead of deleting it, so the purchase history stays intact.`
      );
    }
    return withAppError(async () => {
      await deleteDoc(doc(getDb(), NAME, id));
    }, 'delete supplier');
  },
};

export type SupplierRepositoryType = typeof SupplierRepository;
