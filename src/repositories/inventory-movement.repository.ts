/**
 * InventoryMovementRepository — the append-only stock ledger.
 *
 * Every stock change in BlueBuy lands here. Movements are **never edited or
 * deleted**: a mistake is fixed by recording a compensating `correction`
 * movement, so the ledger always explains how stock reached its current level.
 *
 * Writers:
 *  - {@link InventoryMovementRepository.adjust} — manual operator adjustments
 *    (this file), atomic with the stock change.
 *  - `PurchaseRepository.receive` — goods inwards, atomic with the receipt.
 *  - `OrderRepository.closeWithRestock` — cancellation/return, which posts the
 *    order's `sale` movements and the restocking movement together.
 *  - `OrderRepository.recordSaleMovements` — the `sale` entries for an order.
 *    The storefront checkout does NOT write here: it is unauthenticated, so it
 *    only decrements stock (allowed narrowly in `firestore.rules`) and an admin
 *    action posts the matching ledger entry afterwards.
 */
import {
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS, type Product } from '@/types/models';
import type { ActorRef, InventoryMovement, InventoryMovementType } from '@/types/business';
import { inventoryAdjustmentSchema, type InventoryAdjustmentInput } from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import {
  collectionRef,
  fromSnapshot,
  pruneUndefined,
  queryIn,
  rangeConstraints,
  DEFAULT_QUERY_LIMIT,
} from './shared';

const NAME = COLLECTIONS.inventoryMovements;

/** The outcome of a manual adjustment. */
export interface AdjustmentResult {
  movementId: string;
  productId: string;
  productTitle: string;
  previousStock: number;
  newStock: number;
  quantityChange: number;
}

export const InventoryMovementRepository = {
  /** Movements in a period, newest first. */
  async list(range?: DateRange | null, max = DEFAULT_QUERY_LIMIT): Promise<InventoryMovement[]> {
    return withAppError(async () => {
      const snap = await getDocs(queryIn(NAME, rangeConstraints('occurredAt', range, max)));
      return snap.docs.map((d) => fromSnapshot<InventoryMovement>(d));
    }, 'list inventory movements');
  },

  /** Full movement history for one product, newest first. */
  async listForProduct(productId: string, max = 200): Promise<InventoryMovement[]> {
    return withAppError(async () => {
      // Equality + orderBy on a different field needs a composite index; it is
      // declared in firestore.indexes.json.
      const constraints: QueryConstraint[] = [
        where('productId', '==', productId),
        ...rangeConstraints('occurredAt', null, max),
      ];
      const snap = await getDocs(query(collectionRef(NAME), ...constraints));
      return snap.docs.map((d) => fromSnapshot<InventoryMovement>(d));
    }, 'list product movements');
  },

  /**
   * Apply a manual stock adjustment, atomically with its ledger entry.
   *
   * The operator supplies the **absolute** quantity they counted; the delta is
   * derived inside the transaction from the stock level as it actually stands,
   * so two admins adjusting at once cannot silently overwrite each other. If the
   * stock moved since the form was opened, the write is rejected with a message
   * asking them to re-check rather than clobbering the newer value.
   */
  async adjust(input: InventoryAdjustmentInput, actor: ActorRef): Promise<AdjustmentResult> {
    const data = inventoryAdjustmentSchema.parse(input);
    const db = getDb();
    const productRef = doc(db, COLLECTIONS.products, data.productId);
    const movementRef = doc(collectionRef(NAME));

    return withAppError(async () => {
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(productRef);
        if (!snap.exists()) {
          throw new AppError('not-found', 'That product no longer exists.');
        }
        const product = fromSnapshot<Product>(snap);
        const actualStock = Math.max(0, product.stock ?? 0);

        // Optimistic concurrency: the operator counted against a stock level
        // that has since changed, so their delta would be wrong.
        if (actualStock !== data.currentQuantity) {
          throw new AppError(
            'aborted',
            `Stock for “${product.title}” changed to ${actualStock} while you were editing. Re-check the count and try again.`
          );
        }

        const quantityChange = data.newQuantity - actualStock;

        tx.update(productRef, {
          stock: data.newQuantity,
          updatedAt: serverTimestamp(),
        });

        tx.set(
          movementRef,
          pruneUndefined({
            productId: product.id,
            productTitle: product.title,
            productSlug: product.slug,
            type: data.type,
            quantityChange,
            stockAfter: data.newQuantity,
            // A quantity-only adjustment carries no cost: the units already
            // exist at the product's weighted-average cost, and writing a cost
            // here would corrupt the basis.
            unitCost: null,
            totalValue: null,
            reference: { kind: 'manual', id: '', label: 'Manual adjustment' },
            reason: data.reason,
            notes: data.notes,
            createdBy: actor,
            occurredAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        return {
          movementId: movementRef.id,
          productId: product.id,
          productTitle: product.title,
          previousStock: actualStock,
          newStock: data.newQuantity,
          quantityChange,
        } satisfies AdjustmentResult;
      });
    }, 'adjust stock');
  },

  /**
   * Append a movement that another flow has already applied to stock.
   *
   * Used by flows whose stock write happens in their own transaction (order
   * restocking). Prefer the atomic paths above wherever possible — this exists
   * so a caller that has *already* changed stock can complete the ledger, not as
   * a general-purpose writer.
   */
  async append(movement: {
    productId: string;
    productTitle: string;
    productSlug: string;
    type: InventoryMovementType;
    quantityChange: number;
    stockAfter: number;
    reference: InventoryMovement['reference'];
    reason: string;
    notes?: string;
    createdBy: ActorRef;
  }): Promise<void> {
    return withAppError(async () => {
      const db = getDb();
      await runTransaction(db, async (tx) => {
        tx.set(
          doc(collectionRef(NAME)),
          pruneUndefined({
            ...movement,
            notes: movement.notes ?? '',
            unitCost: null,
            totalValue: null,
            occurredAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });
    }, 'record inventory movement');
  },
};

export type InventoryMovementRepositoryType = typeof InventoryMovementRepository;
