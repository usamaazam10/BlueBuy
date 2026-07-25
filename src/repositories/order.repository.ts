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
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getDb, AppError, withAppError } from '@/firebase';
import { COLLECTIONS, type Product } from '@/types/models';
import type { CreateOrderInput, Order, OrderStatus } from '@/types/order';
import { INITIAL_ORDER_STATUS } from '@/types/order';
import { canTransition } from '@/lib/order/status';
import { createOrderSchema, orderStatusSchema } from '@/lib/validations';

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
};

export type OrderRepositoryType = typeof OrderRepository;
