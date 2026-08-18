/**
 * Business operations domain models — procurement, inventory, money and audit.
 *
 * These describe how documents are shaped **in Firestore**, exactly like
 * `@/types/models` does for the catalogue. They are deliberately kept in a
 * separate file (and NOT re-exported through `@/types`) so the storefront's type
 * surface is unchanged; only the admin/business layer imports from here.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Collection relationships:
 *
 *   purchase_orders.supplierId       ─▶ suppliers.id
 *   purchase_orders.items[].productId ─▶ products.id
 *   purchase_receipts.purchaseOrderId ─▶ purchase_orders.id
 *   inventory_movements.productId    ─▶ products.id
 *   cash_transactions.reference      ─▶ orders.id | purchase_orders.id | expenses.id
 *   expenses.categoryId              ─▶ expense_categories.id
 *   audit_logs.entityId              ─▶ any document
 *
 * As in the catalogue, relationships are stored as ids. Financial records also
 * **denormalise a human label** (supplier name, product title) so accounting
 * history stays readable even if the referenced document is later renamed or
 * deleted — see the "Immutability" note below.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Immutability of financial records
 *
 * Purchase receipts, inventory movements and cash transactions are **append
 * only**. Nothing in the app edits or deletes them; a mistake is corrected by
 * writing a compensating record (a `correction` movement, a reversing cash
 * entry). This keeps accounting history reconstructable and is what makes the
 * weighted-average cost basis auditable.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type { BaseDocument, FirestoreDate } from '@/types/models';

/**
 * Who performed an action. Captured on every financial/inventory record so the
 * audit trail survives even if the user account is later removed.
 *
 * `uid` is `null` for actions taken by an unauthenticated storefront visitor
 * (the checkout's own stock decrement), which is labelled as a system actor.
 */
export interface ActorRef {
  uid: string | null;
  email: string | null;
  /** Display label, e.g. an email or "Storefront checkout". */
  label: string;
}

/** The system actor used for stock movements written by the public checkout. */
export const SYSTEM_ACTOR: ActorRef = {
  uid: null,
  email: null,
  label: 'Storefront checkout',
};

// ───────────────────────────── Suppliers ─────────────────────────────────────

/** Supplier / vendor document — collection: `suppliers`. */
export interface Supplier extends BaseDocument {
  name: string;
  /** Primary contact person at the supplier. */
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  /** Inactive suppliers are hidden from purchase-order pickers but keep history. */
  active: boolean;
}

// ─────────────────────────── Purchase orders ─────────────────────────────────

/**
 * Purchase order lifecycle.
 *
 * **Stock is never changed by a status alone.** It moves only when goods are
 * recorded as received, which writes a {@link PurchaseReceipt}; the status then
 * follows from how much has been received. See `purchase.service.ts`.
 */
export type PurchaseOrderStatus =
  'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export const PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  'draft',
  'ordered',
  'partially_received',
  'received',
  'cancelled',
];

/**
 * Allowed transitions an operator may drive directly. `partially_received` and
 * `received` are reached by *receiving goods*, not by picking a status, so they
 * are absent from the manual targets below.
 */
export const PURCHASE_ORDER_STATUS_FLOW: Record<
  PurchaseOrderStatus,
  readonly PurchaseOrderStatus[]
> = {
  draft: ['ordered', 'cancelled'],
  ordered: ['cancelled'],
  partially_received: ['cancelled'],
  received: [],
  cancelled: [],
};

/**
 * A line on a purchase order.
 *
 * `quantityReceived` is maintained by the receiving flow and is what makes
 * partial receipts possible. Product title/slug are snapshotted so a historical
 * purchase still reads correctly after a product is renamed or deleted.
 */
export interface PurchaseOrderItem {
  /** Reference → products.id */
  productId: string;
  /** Product title at the time the order was raised. */
  title: string;
  slug: string;
  /** Quantity ordered from the supplier. */
  quantity: number;
  /** Quantity actually received so far (0 until the first receipt). */
  quantityReceived: number;
  /** Cost per unit paid to the supplier, in the PO's currency. */
  unitCost: number;
  /** unitCost × quantity — stored so the document self-verifies. */
  lineTotal: number;
}

/** Purchase order document — collection: `purchase_orders`. */
export interface PurchaseOrder extends BaseDocument {
  /** Human-facing number, e.g. `PO-260817-4F7A`. Equals the document id. */
  purchaseOrderNumber: string;
  /** Reference → suppliers.id */
  supplierId: string;
  /** Supplier name snapshotted at creation, for durable history. */
  supplierName: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  /** Sum of line totals. */
  subtotal: number;
  /** Freight/handling charged by the supplier; part of the cash outflow. */
  shippingCost: number;
  /** Taxes and fees on the purchase. */
  taxAmount: number;
  /** subtotal + shippingCost + taxAmount. */
  total: number;
  /** ISO 4217 currency code the purchase was made in. */
  currency: string;
  /** When the order was placed with the supplier. */
  orderedAt: FirestoreDate;
  expectedDeliveryAt: FirestoreDate;
  /** Set when the final receipt lands. */
  actualDeliveryAt: FirestoreDate;
  notes: string;
  createdBy: ActorRef;
}

/** A single received line within a {@link PurchaseReceipt}. */
export interface PurchaseReceiptItem {
  productId: string;
  title: string;
  /** Units received in this receipt (always > 0). */
  quantity: number;
  /** Unit cost applied to this receipt — the input to the weighted average. */
  unitCost: number;
  /** quantity × unitCost. */
  lineTotal: number;
  /** Product stock level immediately after this line was applied. */
  stockAfter: number;
  /** Weighted-average unit cost after this receipt was folded in. */
  averageCostAfter: number;
}

/**
 * An immutable record of goods physically received against a purchase order —
 * collection: `purchase_receipts`.
 *
 * One receipt = one delivery. Receiving twice creates two receipts, and each
 * raises stock exactly once. This is the document that gives every unit in
 * inventory a traceable acquisition cost.
 */
export interface PurchaseReceipt extends BaseDocument {
  /** Reference → purchase_orders.id */
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseReceiptItem[];
  /** Goods value received in this delivery (sum of line totals). */
  totalCost: number;
  currency: string;
  /** When the goods physically arrived. */
  receivedAt: FirestoreDate;
  notes: string;
  receivedBy: ActorRef;
}

// ────────────────────────── Inventory movements ──────────────────────────────

/**
 * Why stock changed. Every stock-changing action in the app writes one of
 * these — stock is never modified silently.
 */
export type InventoryMovementType =
  | 'purchase_received'
  | 'sale'
  | 'return'
  | 'adjustment'
  | 'damaged'
  | 'lost'
  | 'transfer'
  | 'correction';

export const INVENTORY_MOVEMENT_TYPES: readonly InventoryMovementType[] = [
  'purchase_received',
  'sale',
  'return',
  'adjustment',
  'damaged',
  'lost',
  'transfer',
  'correction',
];

/** Movement types an operator may pick when adjusting stock by hand. */
export const MANUAL_MOVEMENT_TYPES: readonly InventoryMovementType[] = [
  'adjustment',
  'damaged',
  'lost',
  'return',
  'transfer',
  'correction',
];

/** What caused a movement, so it can be traced back to its source document. */
export interface MovementReference {
  kind: 'order' | 'purchase' | 'manual';
  /** Source document id (order id, purchase order id) — empty for manual. */
  id: string;
  /** Human label, e.g. the order number. */
  label: string;
}

/**
 * Inventory movement — collection: `inventory_movements`. Append-only ledger.
 *
 * `quantityChange` is **signed**: positive adds stock, negative removes it. The
 * sum of every movement for a product should equal its current stock; the
 * inventory page surfaces any drift so it can be corrected explicitly rather
 * than papered over.
 */
export interface InventoryMovement extends BaseDocument {
  /** Reference → products.id */
  productId: string;
  /** Product title snapshotted at movement time. */
  productTitle: string;
  productSlug: string;
  type: InventoryMovementType;
  /** Signed quantity delta, e.g. +12 received, −2 sold. Never 0. */
  quantityChange: number;
  /** Stock level after the movement was applied. */
  stockAfter: number;
  /**
   * Unit cost attached to the movement, when known — set for purchase receipts
   * and for cost-bearing corrections. `null` for sales (their cost is captured
   * on the order's costing snapshot) and for quantity-only adjustments.
   */
  unitCost: number | null;
  /** |quantityChange| × unitCost, or `null` when `unitCost` is null. */
  totalValue: number | null;
  reference: MovementReference;
  /** Short reason, required for manual adjustments. */
  reason: string;
  notes: string;
  createdBy: ActorRef;
  /** When the movement happened (may pre-date when it was recorded). */
  occurredAt: FirestoreDate;
}

// ──────────────────────────────── Expenses ───────────────────────────────────

/**
 * Configurable expense category — collection: `expense_categories`.
 * `key` is a stable slug used by seeded defaults so re-seeding is idempotent.
 */
export interface ExpenseCategoryDoc extends BaseDocument {
  key: string;
  name: string;
  description: string;
  /**
   * True when spending in this category is inventory procurement rather than an
   * operating cost. Such spend is EXCLUDED from operating expenses so it isn't
   * double-counted against COGS. See `profit.ts`.
   */
  isInventoryProcurement: boolean;
  sortOrder: number;
  active: boolean;
}

/** Default categories seeded on first use. `key` values are stable. */
export const DEFAULT_EXPENSE_CATEGORIES: readonly {
  key: string;
  name: string;
  description: string;
  isInventoryProcurement: boolean;
}[] = [
  {
    key: 'advertising',
    name: 'Advertising',
    description: 'Ads, promotions, influencer spend.',
    isInventoryProcurement: false,
  },
  {
    key: 'shipping',
    name: 'Shipping',
    description: 'Courier and delivery charges.',
    isInventoryProcurement: false,
  },
  {
    key: 'salaries',
    name: 'Salaries',
    description: 'Staff pay and contractor fees.',
    isInventoryProcurement: false,
  },
  {
    key: 'rent',
    name: 'Rent',
    description: 'Premises and storage rent.',
    isInventoryProcurement: false,
  },
  {
    key: 'utilities',
    name: 'Utilities',
    description: 'Electricity, water, internet, phone.',
    isInventoryProcurement: false,
  },
  {
    key: 'software',
    name: 'Software',
    description: 'Subscriptions, hosting, tools.',
    isInventoryProcurement: false,
  },
  {
    key: 'packaging',
    name: 'Packaging',
    description: 'Boxes, tape, filler, labels.',
    isInventoryProcurement: false,
  },
  {
    key: 'office',
    name: 'Office',
    description: 'Supplies and equipment.',
    isInventoryProcurement: false,
  },
  {
    key: 'supplier',
    name: 'Supplier-related',
    description: 'Inventory bought from suppliers.',
    isInventoryProcurement: true,
  },
  {
    key: 'taxes_fees',
    name: 'Taxes & fees',
    description: 'Government dues, bank and platform fees.',
    isInventoryProcurement: false,
  },
  {
    key: 'other',
    name: 'Other',
    description: 'Anything not covered above.',
    isInventoryProcurement: false,
  },
];

/** How money moved. Shared by expenses and cash transactions. */
export type PaymentMethod =
  'cash' | 'bank_transfer' | 'card' | 'mobile_wallet' | 'cheque' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  'cash',
  'bank_transfer',
  'card',
  'mobile_wallet',
  'cheque',
  'other',
];

/** Expense document — collection: `expenses`. */
export interface Expense extends BaseDocument {
  amount: number;
  currency: string;
  /** Reference → expense_categories.id */
  categoryId: string;
  /** Category name snapshotted for durable reporting. */
  categoryName: string;
  /** Mirrors the category's flag at the time of recording. */
  isInventoryProcurement: boolean;
  /** When the expense was incurred. */
  incurredAt: FirestoreDate;
  paymentMethod: PaymentMethod;
  description: string;
  /** Invoice/receipt number or similar. */
  reference: string;
  /**
   * Attachment URL (Cloudinary). Reserved for a future upload flow — the app
   * does not write it yet, but readers already render it when present.
   */
  attachmentUrl: string | null;
  createdBy: ActorRef;
}

// ────────────────────────────── Cash flow ────────────────────────────────────

/** Direction of a cash movement. */
export type CashDirection = 'inflow' | 'outflow';

/**
 * What generated a cash movement. `sale` / `purchase` / `expense` entries are
 * written automatically by the corresponding flows; `manual` covers anything an
 * operator records by hand (owner drawings, capital injection, refunds paid).
 */
export type CashSource = 'sale' | 'purchase' | 'expense' | 'refund' | 'other_income' | 'manual';

export const CASH_SOURCES: readonly CashSource[] = [
  'sale',
  'purchase',
  'expense',
  'refund',
  'other_income',
  'manual',
];

/** Where a cash entry came from, so it can be traced to its source document. */
export interface CashReference {
  kind: 'order' | 'purchase' | 'expense' | 'manual';
  id: string;
  label: string;
}

/**
 * Cash transaction — collection: `cash_transactions`. Append-only.
 *
 * This is **actual money movement**, deliberately distinct from revenue. An
 * order that has been placed but not yet paid for produces revenue and no cash;
 * cash is recorded when the money is genuinely received. See `cashflow.ts`.
 */
export interface CashTransaction extends BaseDocument {
  direction: CashDirection;
  /** Always positive; `direction` carries the sign. */
  amount: number;
  currency: string;
  source: CashSource;
  /** Free-text category, e.g. the expense category name or "Customer payment". */
  category: string;
  description: string;
  /** When the money actually moved. */
  occurredAt: FirestoreDate;
  paymentMethod: PaymentMethod;
  reference: CashReference;
  createdBy: ActorRef;
}

// ───────────────────────────── Analytics ─────────────────────────────────────

/**
 * Commerce events tracked on the storefront. These are BlueBuy's own funnel
 * events — they are not a replacement for a general web-analytics product (see
 * BUSINESS_OPERATIONS.md § Analytics for what stays in GA4).
 */
export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'category_view'
  | 'brand_view'
  | 'search'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'checkout_started'
  | 'checkout_completed'
  | 'whatsapp_click'
  | 'contact_click';

export const ANALYTICS_EVENT_TYPES: readonly AnalyticsEventType[] = [
  'page_view',
  'product_view',
  'category_view',
  'brand_view',
  'search',
  'add_to_cart',
  'remove_from_cart',
  'checkout_started',
  'checkout_completed',
  'whatsapp_click',
  'contact_click',
];

/**
 * A single storefront event — collection: `analytics_events`.
 *
 * Deliberately carries **no personal data**: no IP, no user agent, no customer
 * identity. `sessionId` is a random per-tab id held in `sessionStorage`; it lets
 * the funnel count sessions without identifying anyone.
 *
 * `dayKey` (`YYYY-MM-DD`, in the viewer's local time) is stored alongside the
 * timestamp so the admin can query a date range on a single indexed field.
 */
export interface AnalyticsEvent extends BaseDocument {
  type: AnalyticsEventType;
  /** Random, non-identifying per-tab session id. */
  sessionId: string;
  /** Local-time day bucket, `YYYY-MM-DD`. */
  dayKey: string;
  /** Path the event happened on, without query string. */
  path: string;
  /** Product id for product/cart events; empty otherwise. */
  productId: string;
  /** Product title snapshot, so reports read well without a join. */
  productTitle: string;
  /** Category id for category views; empty otherwise. */
  categoryId: string;
  /** Brand id for brand views; empty otherwise. */
  brandId: string;
  /** Normalised (lowercased, trimmed) search term; empty for non-search events. */
  searchTerm: string;
  /** Result count for a search — lets "searches with no results" be reported. */
  resultCount: number | null;
  /** Units involved, for cart events. */
  quantity: number | null;
  /** Money value involved, for cart/checkout events. */
  value: number | null;
  occurredAt: FirestoreDate;
}

/** The minimum a caller supplies; the tracker fills in the rest. */
export type AnalyticsEventInput = Partial<Omit<AnalyticsEvent, keyof BaseDocument | 'type'>> & {
  type: AnalyticsEventType;
};

/**
 * A precomputed per-day rollup — collection: `analytics_daily`, doc id = dayKey.
 *
 * Raw events are the source of truth; this exists purely so the dashboard can
 * chart long ranges without streaming every event into the browser. It is
 * rebuilt idempotently from raw events (admin → Analytics → Rebuild summaries).
 */
export interface AnalyticsDailySummary extends BaseDocument {
  /** `YYYY-MM-DD`; also the document id. */
  dayKey: string;
  /** Event counts keyed by {@link AnalyticsEventType}. */
  counts: Record<string, number>;
  /** Distinct `sessionId` values seen that day. */
  sessions: number;
  /** Product view counts keyed by product id. */
  productViews: Record<string, number>;
  /** Search term counts. */
  searchTerms: Record<string, number>;
  /** When this rollup was last rebuilt. */
  computedAt: FirestoreDate;
}

// ───────────────────────────── Audit log ─────────────────────────────────────

/** Sensitive operations recorded in the audit trail. */
export type AuditAction =
  | 'product.created'
  | 'product.updated'
  | 'product.archived'
  | 'product.deleted'
  | 'purchase.created'
  | 'purchase.updated'
  | 'purchase.received'
  | 'purchase.cancelled'
  | 'inventory.adjusted'
  | 'expense.created'
  | 'expense.deleted'
  | 'order.status_changed'
  | 'order.delivery_updated'
  | 'order.costed'
  | 'order.returned'
  | 'cash.recorded'
  | 'supplier.created'
  | 'supplier.updated'
  | 'cms.updated'
  | 'settings.updated';

/** Entity kinds an audit entry can point at. */
export type AuditEntity =
  | 'product'
  | 'category'
  | 'brand'
  | 'order'
  | 'purchase_order'
  | 'supplier'
  | 'expense'
  | 'cash_transaction'
  | 'inventory'
  | 'cms'
  | 'settings';

/**
 * Audit log entry — collection: `audit_logs`. Append-only, admin-read-only.
 *
 * `before`/`after` hold only the fields that actually changed (see
 * `diffForAudit`), keeping entries small and readable rather than storing whole
 * documents on every edit.
 */
export interface AuditLog extends BaseDocument {
  action: AuditAction;
  entity: AuditEntity;
  entityId: string;
  /** Human label for the entity, e.g. a product title or order number. */
  entityLabel: string;
  /** Short human-readable summary of what happened. */
  summary: string;
  /** Changed fields before the change; `null` for creates. */
  before: Record<string, unknown> | null;
  /** Changed fields after the change; `null` for deletes. */
  after: Record<string, unknown> | null;
  actor: ActorRef;
  occurredAt: FirestoreDate;
}

// ─────────────────────────── Costing / valuation ─────────────────────────────

/**
 * Inventory cost basis method.
 *
 * BlueBuy uses **weighted average cost** (WAC): each receipt folds its unit cost
 * into a running average held on the product. It is the method that behaves
 * correctly with a static, client-only architecture — it needs no per-unit lot
 * tracking and no server-side FIFO queue, and it is stable under out-of-order
 * receipts. See `@/lib/business/costing` and BUSINESS_OPERATIONS.md.
 */
export type CostMethod = 'weighted_average';

export const COST_METHOD: CostMethod = 'weighted_average';

/** Per-line cost captured against an order at fulfilment time. */
export interface OrderCostLine {
  productId: string;
  title: string;
  quantity: number;
  /** Weighted-average unit cost in effect when the cost was captured. */
  unitCost: number;
  /** quantity × unitCost. */
  lineCost: number;
}

/**
 * The COGS snapshot stored on an order.
 *
 * Captured by an admin action (confirming an order, or "capture costs"), never
 * by the storefront — customers must never be able to read or write cost data.
 * Once captured it is **never recomputed**, so historical margin stays accurate
 * even after purchase costs change.
 */
export interface OrderCosting {
  method: CostMethod;
  lines: OrderCostLine[];
  /** Sum of line costs — the order's cost of goods sold. */
  totalCost: number;
  /**
   * True only when every line resolved a real cost basis. When false the order's
   * profit is reported as "insufficient cost data" rather than as a number.
   */
  complete: boolean;
  capturedAt: FirestoreDate;
  capturedBy: ActorRef;
}

/** Courier/fulfilment details attached to an order by the admin. */
export interface OrderDelivery {
  courier: string;
  trackingNumber: string;
  /** What the courier charged the business — a cash outflow, not revenue. */
  deliveryCost: number;
  shippedAt: FirestoreDate;
  expectedDeliveryAt: FirestoreDate;
  deliveredAt: FirestoreDate;
  notes: string;
}
