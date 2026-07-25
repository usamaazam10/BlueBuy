/**
 * Order domain types.
 *
 * An order is an immutable *snapshot* of a completed checkout. Like the cart
 * (see `@/types/cart`), each {@link OrderItem} captures the product's title,
 * price and image at purchase time, so an order always renders and totals
 * correctly regardless of later catalogue changes — and the customer is billed
 * exactly what they saw.
 *
 * Orders are the one place UI and Firestore share a single shape: there is no
 * mock-data legacy to keep separate (unlike products), so this file is the
 * canonical model used by the repository, service, admin and storefront alike.
 * The collection name lives in `COLLECTIONS.orders` (`@/types/models`).
 */
import type { FirestoreDate } from '@/types/models';

/**
 * Order lifecycle states, in fulfilment order. `cancelled` is a terminal state
 * reachable from any non-delivered status. See {@link ORDER_STATUS_FLOW} for the
 * allowed transitions and `@/lib/order/status` for labels/metadata.
 */
export type OrderStatus =
  'pending' | 'confirmed' | 'packed' | 'shipped' | 'delivered' | 'cancelled';

/** All statuses in display order. */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
];

/** Status a freshly-placed order starts in. */
export const INITIAL_ORDER_STATUS: OrderStatus = 'pending';

/**
 * Allowed forward transitions per status. A status maps to the set of statuses
 * an admin may move it to. Delivered and cancelled are terminal (empty sets).
 * Every non-terminal status can also be cancelled.
 */
export const ORDER_STATUS_FLOW: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

/**
 * Customer contact + delivery details collected at checkout. This is a
 * cash-on-delivery / manual-fulfilment flow (no online payment), so no card or
 * billing data is ever collected or stored.
 */
export interface OrderCustomer {
  /** Full name of the person placing the order. */
  fullName: string;
  /** Contact phone number (also used for the WhatsApp handoff). */
  phone: string;
  /** Optional email for order updates. */
  email?: string;
  /** Delivery city. */
  city: string;
  /** Complete street/delivery address. */
  address: string;
  /** Optional free-form notes from the customer (delivery instructions, etc.). */
  notes?: string;
}

/**
 * A single purchased line — a snapshot of the cart item at checkout time.
 * `lineTotal` is stored (not just derived) so the order document is a complete,
 * self-verifying record that never depends on re-reading the catalogue.
 */
export interface OrderItem {
  /** Reference → products.id (used for inventory decrement). */
  productId: string;
  slug: string;
  title: string;
  /** Thumbnail URL captured at purchase time, if any. */
  image?: string;
  /** Accent hex driving the placeholder art when there's no image. */
  accent: string;
  /** Unit price at purchase time. */
  unitPrice: number;
  quantity: number;
  /** unitPrice × quantity, captured at purchase time. */
  lineTotal: number;
}

/**
 * A persisted order document — collection: `orders`.
 *
 * `id` is the Firestore document id and is identical to {@link orderId} (the
 * human-facing order number, e.g. `BB-260724-4F7A`), so an order can be looked
 * up directly by its number with no secondary query.
 */
export interface Order {
  /** Firestore document id — equals {@link orderId}. */
  id: string;
  /** Human-facing order number, e.g. `BB-260724-4F7A`. */
  orderId: string;
  customer: OrderCustomer;
  items: OrderItem[];
  /** Sum of line totals before adjustments. */
  subtotal: number;
  /** Shipping charge (0 when free). */
  shipping: number;
  /** Discount amount subtracted (>= 0). */
  discount: number;
  /** Grand total the customer pays (subtotal − discount + shipping). */
  total: number;
  /** ISO 4217 currency code, e.g. "USD". */
  currency: string;
  status: OrderStatus;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
}

/**
 * Payload the service hands the repository to create an order. Server-managed
 * fields (`id`, `orderId`, `status`, timestamps) are stamped during creation.
 */
export interface CreateOrderInput {
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
}
