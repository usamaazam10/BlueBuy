/**
 * OrderRepository — the single gateway to the `orders` Firestore collection.
 *
 * Rules of the road (mirrors `ProductRepository`):
 *  - **Components never touch Firestore directly.** They go through the
 *    {@link OrderService}, which orchestrates this repository.
 *  - Payloads are validated with the shared Zod schema in `@/lib/validations`,
 *    so a malformed order can never be written regardless of caller.
 *  - Every thrown error is an `AppError` with a user-safe message.
 *
 * Atomicity: {@link OrderRepository.create} writes the order **and** decrements
 * each product's stock inside a single Firestore transaction. Either everything
 * commits or nothing does — you can never sell stock you don't have, and a
 * failed inventory check leaves the order uncreated. The order's document id is
 * its human-facing `orderId`, so an order is addressable by its number alone.
 *
 * Security: status updates are a privileged action. The `/admin` surface is
 * gated by auth (see `src/app/admin/layout.tsx`) and Firestore Security Rules
 * are the true enforcement point — customers can create orders but only
 * authenticated admins may mutate `status`. See ORDER_MANAGEMENT.md.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS, type Product } from '@/types/models';
import type { CreateOrderInput, Order, OrderStatus } from '@/types/order';
import { INITIAL_ORDER_STATUS } from '@/types/order';
import type { ActorRef, OrderCosting, OrderDelivery } from '@/types/business';
import { canTransition } from '@/lib/order/status';
import {
  createOrderSchema,
  orderCostingSchema,
  orderDeliverySchema,
  orderStatusSchema,
} from '@/lib/validations';

/** Firestore collection reference for orders. */
function ordersCollection() {
  return collection(getDb(), COLLECTIONS.orders);
}

/** Map a Firestore snapshot into a typed `Order` (doc id + data). */
function fromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): Order {
  const data = snapshot.data();
  return { ...(data as Omit<Order, 'id'>), id: snapshot.id };
}

/**
 * Recursively drop `undefined` properties. Firestore rejects `undefined`
 * values, so optional fields (email, notes, item image) must be absent rather
 * than set to `undefined` before a write.
 */
function pruneUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => pruneUndefined(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) out[key] = pruneUndefined(val);
    }
    return out as T;
  }
  return value;
}

export const OrderRepository = {
  /**
   * Create an order and decrement stock atomically.
   *
   * @param orderId Human-facing order number, used as the document id.
   * @param input   Validated create payload (customer, items, money totals).
   *
   * Throws `AppError('not-found')` if a referenced product no longer exists,
   * or `AppError('invalid-argument')` if any line exceeds available stock — in
   * which case the transaction aborts and nothing is written.
   */
  async create(orderId: string, input: CreateOrderInput): Promise<Order> {
    // Validation is enforced here, not trusted from the caller.
    const data = createOrderSchema.parse(input);
    const db = getDb();
    const orderRef = doc(db, COLLECTIONS.orders, orderId);

    await withAppError(async () => {
      await runTransaction(db, async (tx) => {
        // NB: we intentionally do NOT read the order doc here. Customers place
        // orders unauthenticated, and `orders` reads are admin-only — reading it
        // would be denied. The random order number makes a collision
        // astronomically unlikely, and the `create` security rule rejects an
        // overwrite of an existing doc anyway, so the guard isn't needed.

        // --- Reads first (Firestore requires all reads before any write). ---
        const stockUpdates: { ref: ReturnType<typeof doc>; nextStock: number }[] = [];
        for (const item of data.items) {
          const productRef = doc(db, COLLECTIONS.products, item.productId);
          const snap = await tx.get(productRef);
          if (!snap.exists()) {
            throw new AppError('not-found', `“${item.title}” is no longer available.`);
          }
          const product = snap.data() as Product;
          const available = typeof product.stock === 'number' ? product.stock : 0;
          if (available < item.quantity) {
            throw new AppError(
              'invalid-argument',
              `Only ${available} of “${item.title}” left in stock.`
            );
          }
          stockUpdates.push({ ref: productRef, nextStock: available - item.quantity });
        }

        // --- Writes: decrement each product, then create the order. ---
        for (const update of stockUpdates) {
          tx.update(update.ref, { stock: update.nextStock, updatedAt: serverTimestamp() });
        }
        tx.set(
          orderRef,
          pruneUndefined({
            orderId,
            customer: data.customer,
            items: data.items,
            subtotal: data.subtotal,
            shipping: data.shipping,
            discount: data.discount,
            total: data.total,
            currency: data.currency,
            status: INITIAL_ORDER_STATUS,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
      });
    }, 'place order');

    // Return the created order constructed from what we wrote — deliberately
    // NOT a read-back. Customers place orders unauthenticated, so a re-read
    // would force `orders` to be publicly readable (leaking every buyer's PII).
    // The only field the write resolves server-side is the timestamp; the
    // confirmation UI doesn't display it, and the admin list reads the real
    // value, so a client `Date` here is a faithful stand-in.
    const now = new Date();
    return {
      id: orderId,
      orderId,
      customer: data.customer,
      items: data.items,
      subtotal: data.subtotal,
      shipping: data.shipping,
      discount: data.discount,
      total: data.total,
      currency: data.currency,
      status: INITIAL_ORDER_STATUS,
      createdAt: now,
      updatedAt: now,
    };
  },

  /** Fetch a single order by id (equals its order number), or `null`. */
  async getById(id: string): Promise<Order | null> {
    return withAppError(async () => {
      const snapshot = await getDoc(doc(getDb(), COLLECTIONS.orders, id));
      return snapshot.exists() ? fromSnapshot(snapshot) : null;
    }, 'load order');
  },

  /** List all orders, newest first. */
  async list(): Promise<Order[]> {
    return withAppError(async () => {
      const snap = await getDocs(query(ordersCollection(), orderBy('createdAt', 'desc')));
      return snap.docs.map(fromSnapshot);
    }, 'list orders');
  },

  /**
   * Orders created within a window, newest first.
   *
   * The business dashboards use this instead of {@link list} so a store with a
   * long history doesn't stream every order into the browser to render a
   * 30-day KPI. Callers that need a period *and* its comparison fetch one range
   * spanning both and split client-side — one read, not two.
   */
  async listInRange(start: Date, end: Date, max = 2000): Promise<Order[]> {
    return withAppError(async () => {
      const snap = await getDocs(
        query(
          ordersCollection(),
          where('createdAt', '>=', start),
          where('createdAt', '<', end),
          orderBy('createdAt', 'desc'),
          limit(max)
        )
      );
      return snap.docs.map(fromSnapshot);
    }, 'list orders');
  },

  /**
   * Update an order's status. Rejects an invalid transition (see the lifecycle
   * in `@/types/order`) so an order can't skip or reverse states. Admin-only in
   * practice — enforced by auth + Firestore Security Rules.
   */
  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    orderStatusSchema.parse(status);
    const ref = doc(getDb(), COLLECTIONS.orders, id);

    return withAppError(async () => {
      const current = await getDoc(ref);
      if (!current.exists()) throw new AppError('not-found', 'The order no longer exists.');

      const order = fromSnapshot(current as QueryDocumentSnapshot<DocumentData>);
      if (order.status === status) return order;
      if (!canTransition(order.status, status)) {
        throw new AppError(
          'invalid-argument',
          `Can't move an order from “${order.status}” to “${status}”.`
        );
      }

      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'update order status');
  },

  // ─────────────────── Business operations (admin-only) ────────────────────
  // The methods below write fields the storefront can neither read nor set —
  // cost snapshots, courier details, refunds. The `orders` create rule pins the
  // exact field set an anonymous checkout may write, so none of these can be
  // supplied at checkout time; they are added later by an authenticated admin.

  /**
   * Attach a cost-of-goods snapshot to an order.
   *
   * Refuses to overwrite an existing snapshot: once captured, an order's cost is
   * history, and recapturing it later at a different weighted average would
   * silently rewrite past margin. Correcting a genuinely wrong snapshot is a
   * deliberate act — pass `force`.
   */
  async applyCosting(id: string, costing: OrderCosting, force = false): Promise<Order> {
    orderCostingSchema.parse(costing);
    const ref = doc(getDb(), COLLECTIONS.orders, id);

    return withAppError(async () => {
      const current = await getDoc(ref);
      if (!current.exists()) throw new AppError('not-found', 'The order no longer exists.');
      const order = fromSnapshot(current as QueryDocumentSnapshot<DocumentData>);

      if (order.costing && !force) {
        throw new AppError(
          'failed-precondition',
          'This order already has a cost snapshot. Re-capturing would rewrite historical profit.'
        );
      }

      await updateDoc(ref, { costing: pruneUndefined(costing), updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'capture order costs');
  },

  /**
   * Append the `sale` inventory movements for an order, atomically and once.
   *
   * Checkout already decremented stock, so this writes **ledger entries only**
   * — it must not touch `stock` again. `saleMovementsRecorded` is set in the
   * same transaction and checked first, so calling this repeatedly (or from both
   * the costing flow and the reconcile tool) can never double-post.
   *
   * `stockAfter` is read from the product at posting time. It is therefore the
   * level *now*, not necessarily the instant after the sale — an acceptable
   * approximation for a ledger entry written after the fact, and noted as such
   * in BUSINESS_OPERATIONS.md § Inventory ledger.
   */
  async recordSaleMovements(
    id: string,
    actor: ActorRef
  ): Promise<{ recorded: boolean; lines: number }> {
    const db = getDb();
    const orderRef = doc(db, COLLECTIONS.orders, id);

    return withAppError(async () => {
      return runTransaction(db, async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new AppError('not-found', 'The order no longer exists.');
        const order = fromSnapshot(orderSnap as QueryDocumentSnapshot<DocumentData>);

        if (order.saleMovementsRecorded) return { recorded: false, lines: 0 };

        const levels = new Map<string, number>();
        for (const item of order.items) {
          const snap = await tx.get(doc(db, COLLECTIONS.products, item.productId));
          if (snap.exists()) levels.set(item.productId, (snap.data() as Product).stock ?? 0);
        }

        let lines = 0;
        for (const item of order.items) {
          const stockAfter = levels.get(item.productId);
          if (stockAfter === undefined) continue;
          lines += 1;
          tx.set(
            doc(collection(db, COLLECTIONS.inventoryMovements)),
            pruneUndefined({
              productId: item.productId,
              productTitle: item.title,
              productSlug: item.slug,
              type: 'sale',
              quantityChange: -item.quantity,
              stockAfter,
              // Cost lives on the order's costing snapshot, not here — a sale
              // movement carrying its own cost would create a second, divergent
              // source of truth for COGS.
              unitCost: null,
              totalValue: null,
              reference: { kind: 'order', id: order.id, label: order.orderId },
              reason: 'Sold at checkout',
              notes: '',
              createdBy: actor,
              occurredAt: order.createdAt ?? serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          );
        }

        tx.update(orderRef, { saleMovementsRecorded: true, updatedAt: serverTimestamp() });
        return { recorded: true, lines };
      });
    }, 'record sale movements');
  },

  /** Set or update courier / fulfilment details on an order. */
  async updateDelivery(id: string, delivery: OrderDelivery): Promise<Order> {
    orderDeliverySchema.parse(delivery);
    const ref = doc(getDb(), COLLECTIONS.orders, id);

    return withAppError(async () => {
      await updateDoc(ref, { delivery: pruneUndefined(delivery), updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'The order no longer exists.');
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'update delivery details');
  },

  /** Record an amount refunded to the customer. */
  async setRefund(id: string, amount: number): Promise<Order> {
    const ref = doc(getDb(), COLLECTIONS.orders, id);
    return withAppError(async () => {
      await updateDoc(ref, { refundedAmount: amount, updatedAt: serverTimestamp() });
      const updated = await getDoc(ref);
      if (!updated.exists()) throw new AppError('not-found', 'The order no longer exists.');
      return fromSnapshot(updated as QueryDocumentSnapshot<DocumentData>);
    }, 'record refund');
  },

  /**
   * Close an order into `cancelled` or `returned` — status, stock and ledger in
   * ONE transaction.
   *
   * Three things must happen together when an order ends in a state where the
   * goods come back, and splitting them is what used to go wrong:
   *
   *  1. **The status changes.** Validated against the lifecycle, so an order
   *     can't be cancelled from a state that forbids it.
   *  2. **The stock comes back.** Checkout decremented it at placement, so
   *     leaving it out would permanently lose sellable inventory.
   *  3. **The ledger explains both.** Checkout writes no movement of its own
   *     (it is unauthenticated — see {@link recordSaleMovements}), so if the
   *     order was never costed, its `sale` movements are posted here first.
   *     Without that the restore's `+n` has no matching `−n` and the movement
   *     ledger drifts away from `stock` permanently, with no way to reconcile
   *     it: `reconcileSaleMovements` deliberately skips cancelled orders.
   *
   * Doing all three in one transaction also means a caller who lacks permission
   * to write stock (a `sales_manager`, say — see `firestore.rules`) changes
   * *nothing at all* rather than flipping the status and silently failing to
   * restock. Both idempotence flags are set inside the transaction and checked
   * first, so a double cancellation can never inflate stock or double-post.
   *
   * @param restock When false the goods are NOT returned to sellable stock —
   *   used for a return that comes back damaged or unsellable. The sale
   *   movements are still posted, so the ledger stays balanced against the
   *   units that left; they simply never come back.
   */
  async closeWithRestock(
    id: string,
    status: Extract<OrderStatus, 'cancelled' | 'returned'>,
    actor: ActorRef,
    reason: string,
    restock = true
  ): Promise<{ order: Order; restoredUnits: number; saleLines: number }> {
    const db = getDb();
    const orderRef = doc(db, COLLECTIONS.orders, id);
    const movementType = status === 'returned' ? 'return' : 'correction';

    return withAppError(async () => {
      return runTransaction(db, async (tx) => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new AppError('not-found', 'The order no longer exists.');
        const order = fromSnapshot(orderSnap as QueryDocumentSnapshot<DocumentData>);

        if (order.status !== status && !canTransition(order.status, status)) {
          throw new AppError(
            'invalid-argument',
            `Can't move an order from “${order.status}” to “${status}”.`
          );
        }

        // ── Reads first: Firestore requires every read before any write. ──
        const entries: {
          ref: ReturnType<typeof doc>;
          stock: number;
          item: Order['items'][number];
        }[] = [];
        for (const item of order.items) {
          const productRef = doc(db, COLLECTIONS.products, item.productId);
          const snap = await tx.get(productRef);
          // A product deleted since the order was placed simply can't be
          // restocked or ledgered; the rest of the order still is.
          if (!snap.exists()) continue;
          const product = snap.data() as Product;
          entries.push({
            ref: productRef,
            stock: typeof product.stock === 'number' ? product.stock : 0,
            item,
          });
        }

        // ── Write the sale movements the checkout could not write itself. ──
        // `stockAfter` is the level as it stands now, which is exactly the
        // level the sale left behind — nothing has restocked yet.
        let saleLines = 0;
        if (!order.saleMovementsRecorded) {
          for (const entry of entries) {
            saleLines += 1;
            tx.set(
              doc(collection(db, COLLECTIONS.inventoryMovements)),
              pruneUndefined({
                productId: entry.item.productId,
                productTitle: entry.item.title,
                productSlug: entry.item.slug,
                type: 'sale',
                quantityChange: -entry.item.quantity,
                stockAfter: entry.stock,
                unitCost: null,
                totalValue: null,
                reference: { kind: 'order', id: order.id, label: order.orderId },
                reason: 'Sold at checkout',
                notes: '',
                createdBy: actor,
                occurredAt: order.createdAt ?? serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }
        }

        // ── Return the units to stock and record why. ──
        let restoredUnits = 0;
        if (restock && !order.inventoryRestored) {
          for (const entry of entries) {
            const nextStock = entry.stock + entry.item.quantity;
            restoredUnits += entry.item.quantity;

            tx.update(entry.ref, { stock: nextStock, updatedAt: serverTimestamp() });
            tx.set(
              doc(collection(db, COLLECTIONS.inventoryMovements)),
              pruneUndefined({
                productId: entry.item.productId,
                productTitle: entry.item.title,
                productSlug: entry.item.slug,
                type: movementType,
                quantityChange: entry.item.quantity,
                stockAfter: nextStock,
                unitCost: null,
                totalValue: null,
                reference: { kind: 'order', id: order.id, label: order.orderId },
                reason,
                notes: '',
                createdBy: actor,
                occurredAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }
        }

        tx.update(orderRef, {
          status,
          saleMovementsRecorded: true,
          // Goods that deliberately did not come back are still "dealt with":
          // flagging them prevents a later restore silently resurrecting them.
          inventoryRestored: true,
          updatedAt: serverTimestamp(),
        });

        return {
          order: { ...order, status, saleMovementsRecorded: true, inventoryRestored: true },
          restoredUnits,
          saleLines,
        };
      });
    }, 'close order');
  },
};

export type OrderRepositoryType = typeof OrderRepository;
