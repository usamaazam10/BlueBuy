/**
 * PurchaseRepository — the gateway to `purchase_orders` and `purchase_receipts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * The critical operation here is {@link PurchaseRepository.receive}, which runs
 * in a **single Firestore transaction** and is the only place in the app that
 * raises stock. In one atomic step it:
 *
 *   1. reads every affected product,
 *   2. folds each received line into the product's weighted-average cost,
 *   3. raises `stock` and writes the new cost basis,
 *   4. appends one `inventory_movements` entry per line,
 *   5. writes an immutable `purchase_receipts` document,
 *   6. advances the purchase order's per-line `quantityReceived` and status.
 *
 * Either all of that commits or none of it does. That is what guarantees the two
 * data-integrity rules the business depends on: **stock rises only when goods
 * actually arrive**, and **a receipt can never raise stock twice**.
 *
 * Creating or "ordering" a purchase order deliberately changes no stock at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS, type Product } from '@/types/models';
import type {
  ActorRef,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseReceipt,
  PurchaseReceiptItem,
} from '@/types/business';
import { PURCHASE_ORDER_STATUS_FLOW } from '@/types/business';
import {
  purchaseOrderCreateSchema,
  purchaseOrderUpdateSchema,
  receiveGoodsSchema,
  type PurchaseOrderCreateInput,
  type PurchaseOrderUpdateInput,
  type ReceiveGoodsInput,
} from '@/lib/validations';
import { applyReceipt } from '@/lib/business/costing';
import { roundMoney } from '@/lib/business/metrics';
import type { DateRange } from '@/lib/business/date-range';
import {
  collectionRef,
  fromSnapshot,
  pruneUndefined,
  queryIn,
  rangeConstraints,
  DEFAULT_QUERY_LIMIT,
} from './shared';

const ORDERS = COLLECTIONS.purchaseOrders;
const RECEIPTS = COLLECTIONS.purchaseReceipts;

/** Result of a receiving operation, for the audit trail and UI feedback. */
export interface ReceiveResult {
  receiptId: string;
  purchaseOrder: PurchaseOrder;
  /** Units received per product, and the cost basis each ended up with. */
  lines: PurchaseReceiptItem[];
  totalCost: number;
  /** True when this receipt completed the order. */
  fullyReceived: boolean;
}

export const PurchaseRepository = {
  // ───────────────────────────── Purchase orders ─────────────────────────────

  /**
   * List purchase orders, newest first. Filtered server-side by `createdAt` when
   * a range is supplied so a long history never lands in the browser at once.
   */
  async list(range?: DateRange | null, max = DEFAULT_QUERY_LIMIT): Promise<PurchaseOrder[]> {
    return withAppError(async () => {
      const snap = await getDocs(queryIn(ORDERS, rangeConstraints('createdAt', range, max)));
      return snap.docs.map((d) => fromSnapshot<PurchaseOrder>(d));
    }, 'list purchase orders');
  },

  async getById(id: string): Promise<PurchaseOrder | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), ORDERS, id));
      return snapshot.exists() ? fromSnapshot<PurchaseOrder>(snapshot) : null;
    }, 'load purchase order');
  },

  /**
   * Create a purchase order. The document id is the human-facing PO number, so
   * an order is addressable by its number with no secondary query — mirroring
   * how `orders` are keyed by their order number.
   *
   * Writes **no** stock: goods have not arrived yet.
   */
  async create(
    purchaseOrderNumber: string,
    input: PurchaseOrderCreateInput
  ): Promise<PurchaseOrder> {
    const data = purchaseOrderCreateSchema.parse({ ...input, purchaseOrderNumber });

    return withAppError(async () => {
      const ref = doc(getDb(), ORDERS, purchaseOrderNumber);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        throw new AppError('already-exists', 'That purchase order number is already in use.');
      }
      await runTransaction(getDb(), async (tx) => {
        tx.set(
          ref,
          pruneUndefined({
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });
      const created = await getDoc(ref);
      return fromSnapshot<PurchaseOrder>(created as QueryDocumentSnapshot<DocumentData>);
    }, 'create purchase order');
  },

  /**
   * Edit a purchase order. Only a `draft` may be edited — once goods have been
   * ordered or received, the document is part of the accounting record and is
   * corrected by receiving/cancelling rather than by rewriting history.
   */
  async update(id: string, input: PurchaseOrderUpdateInput): Promise<PurchaseOrder> {
    const data = purchaseOrderUpdateSchema.parse(input);

    return withAppError(async () => {
      const ref = doc(getDb(), ORDERS, id);
      const current = await getDoc(ref);
      if (!current.exists()) {
        throw new AppError('not-found', 'The purchase order no longer exists.');
      }
      const order = fromSnapshot<PurchaseOrder>(current);
      if (order.status !== 'draft') {
        throw new AppError(
          'failed-precondition',
          'Only a draft purchase order can be edited. Cancel it and raise a new one instead.'
        );
      }
      await updateDoc(ref, { ...pruneUndefined(data), updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      return fromSnapshot<PurchaseOrder>(updated);
    }, 'update purchase order');
  },

  /**
   * Move a purchase order between the statuses an operator drives directly.
   * `partially_received` / `received` are reached only by {@link receive}.
   */
  async updateStatus(id: string, status: PurchaseOrderStatus): Promise<PurchaseOrder> {
    return withAppError(async () => {
      const ref = doc(getDb(), ORDERS, id);
      const current = await getDoc(ref);
      if (!current.exists()) {
        throw new AppError('not-found', 'The purchase order no longer exists.');
      }
      const order = fromSnapshot<PurchaseOrder>(current);
      if (order.status === status) return order;

      const allowed = PURCHASE_ORDER_STATUS_FLOW[order.status];
      if (!allowed.includes(status)) {
        throw new AppError(
          'invalid-argument',
          `Can't move a purchase order from “${order.status}” to “${status}”.`
        );
      }

      const patch: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
      if (status === 'ordered' && !order.orderedAt) patch.orderedAt = serverTimestamp();

      await updateDoc(ref, patch);
      const updated = await getDoc(ref);
      return fromSnapshot<PurchaseOrder>(updated);
    }, 'update purchase order status');
  },

  // ──────────────────────────────── Receiving ────────────────────────────────

  /**
   * Record goods received against a purchase order — atomically.
   *
   * @param input  Which lines arrived, how many, and at what unit cost (the
   *               invoiced cost may differ from the ordered cost).
   * @param actor  Who recorded the receipt, for the movement + receipt records.
   *
   * Rejects when the order is a draft or cancelled, when a line would exceed the
   * quantity ordered, or when a referenced product no longer exists — in every
   * case nothing is written.
   */
  async receive(input: ReceiveGoodsInput, actor: ActorRef): Promise<ReceiveResult> {
    const data = receiveGoodsSchema.parse(input);
    const received = data.lines.filter((line) => line.quantity > 0);
    if (received.length === 0) {
      throw new AppError('invalid-argument', 'Enter a quantity for at least one line.');
    }

    const db = getDb();
    const orderRef = doc(db, ORDERS, data.purchaseOrderId);
    const receiptRef = doc(collectionRef(RECEIPTS));

    const result = await withAppError(async () => {
      return runTransaction(db, async (tx) => {
        // ── Reads first: Firestore requires every read before any write. ──
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) {
          throw new AppError('not-found', 'The purchase order no longer exists.');
        }
        const order = fromSnapshot<PurchaseOrder>(orderSnap);

        if (order.status === 'cancelled') {
          throw new AppError('failed-precondition', 'This purchase order was cancelled.');
        }
        if (order.status === 'draft') {
          throw new AppError(
            'failed-precondition',
            'Mark the purchase order as ordered before receiving goods against it.'
          );
        }

        // Read every affected product up front.
        const products = new Map<string, { ref: ReturnType<typeof doc>; data: Product }>();
        for (const line of received) {
          const productRef = doc(db, COLLECTIONS.products, line.productId);
          const snap = await tx.get(productRef);
          if (!snap.exists()) {
            throw new AppError(
              'not-found',
              'A product on this purchase order no longer exists. Cancel the order and raise a new one.'
            );
          }
          products.set(line.productId, {
            ref: productRef,
            data: fromSnapshot<Product>(snap),
          });
        }

        // ── Compute: fold each line into its product's weighted average. ──
        const items: PurchaseReceiptItem[] = [];
        const nextItems: PurchaseOrderItem[] = order.items.map((item) => ({ ...item }));

        for (const line of received) {
          const orderLine = nextItems.find((item) => item.productId === line.productId);
          if (!orderLine) {
            throw new AppError(
              'invalid-argument',
              'A received line does not appear on this purchase order.'
            );
          }
          const outstanding = orderLine.quantity - orderLine.quantityReceived;
          if (line.quantity > outstanding) {
            throw new AppError(
              'invalid-argument',
              `“${orderLine.title}”: only ${outstanding} unit${outstanding === 1 ? '' : 's'} are still outstanding.`
            );
          }

          const entry = products.get(line.productId);
          if (!entry) continue;

          const stockBefore = Math.max(0, entry.data.stock ?? 0);
          const costed = applyReceipt(
            stockBefore,
            entry.data.averageCost ?? null,
            line.quantity,
            line.unitCost
          );

          items.push({
            productId: line.productId,
            title: orderLine.title,
            quantity: line.quantity,
            unitCost: line.unitCost,
            lineTotal: roundMoney(line.unitCost * line.quantity),
            stockAfter: costed.stockAfter,
            averageCostAfter: costed.averageCost,
          });

          orderLine.quantityReceived += line.quantity;

          // ── Write: product stock + cost basis. ──
          tx.update(entry.ref, {
            stock: costed.stockAfter,
            averageCost: costed.averageCost,
            lastPurchaseCost: line.unitCost,
            updatedAt: serverTimestamp(),
          });

          // ── Write: the inventory movement for this line. ──
          tx.set(
            doc(collectionRef(COLLECTIONS.inventoryMovements)),
            pruneUndefined({
              productId: line.productId,
              productTitle: orderLine.title,
              productSlug: orderLine.slug ?? '',
              type: 'purchase_received',
              quantityChange: line.quantity,
              stockAfter: costed.stockAfter,
              unitCost: line.unitCost,
              totalValue: roundMoney(line.unitCost * line.quantity),
              reference: {
                kind: 'purchase',
                id: order.id,
                label: order.purchaseOrderNumber,
              },
              reason: 'Goods received',
              notes: data.notes,
              createdBy: actor,
              occurredAt: data.receivedAt,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        const totalCost = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
        const fullyReceived = nextItems.every((item) => item.quantityReceived >= item.quantity);

        // ── Write: the immutable receipt. ──
        tx.set(
          receiptRef,
          pruneUndefined({
            purchaseOrderId: order.id,
            purchaseOrderNumber: order.purchaseOrderNumber,
            supplierId: order.supplierId,
            supplierName: order.supplierName,
            items,
            totalCost,
            currency: order.currency,
            receivedAt: data.receivedAt,
            notes: data.notes,
            receivedBy: actor,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );

        // ── Write: advance the purchase order. ──
        tx.update(orderRef, {
          items: nextItems,
          status: fullyReceived ? 'received' : 'partially_received',
          ...(fullyReceived ? { actualDeliveryAt: data.receivedAt } : {}),
          updatedAt: serverTimestamp(),
        });

        return {
          receiptId: receiptRef.id,
          purchaseOrder: {
            ...order,
            items: nextItems,
            status: (fullyReceived ? 'received' : 'partially_received') as PurchaseOrderStatus,
          },
          lines: items,
          totalCost,
          fullyReceived,
        } satisfies ReceiveResult;
      });
    }, 'receive goods');

    return result;
  },

  // ──────────────────────────────── Receipts ─────────────────────────────────

  /** Receipts for one purchase order, newest first. */
  async listReceiptsFor(purchaseOrderId: string): Promise<PurchaseReceipt[]> {
    return withAppError(async () => {
      // Single equality filter keeps this on the automatic index; the handful of
      // receipts per order are ordered client-side.
      const snap = await getDocs(
        query(collectionRef(RECEIPTS), where('purchaseOrderId', '==', purchaseOrderId))
      );
      return snap.docs
        .map((d) => fromSnapshot<PurchaseReceipt>(d))
        .sort((a, b) => {
          const at = a.receivedAt instanceof Date ? a.receivedAt.getTime() : 0;
          const bt = b.receivedAt instanceof Date ? b.receivedAt.getTime() : 0;
          return bt - at;
        });
    }, 'list receipts');
  },

  /** All receipts in a period — the source for purchase reporting. */
  async listReceipts(
    range?: DateRange | null,
    max = DEFAULT_QUERY_LIMIT
  ): Promise<PurchaseReceipt[]> {
    return withAppError(async () => {
      const snap = await getDocs(queryIn(RECEIPTS, rangeConstraints('receivedAt', range, max)));
      return snap.docs.map((d) => fromSnapshot<PurchaseReceipt>(d));
    }, 'list receipts');
  },

  /** Purchase orders for one supplier, newest first. */
  async listBySupplier(supplierId: string): Promise<PurchaseOrder[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(
          collectionRef(ORDERS),
          where('supplierId', '==', supplierId),
          orderBy('createdAt', 'desc')
        )
      );
      return snap.docs.map((d) => fromSnapshot<PurchaseOrder>(d));
    }, 'list purchase orders');
  },
};

export type PurchaseRepositoryType = typeof PurchaseRepository;
