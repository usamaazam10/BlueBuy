/**
 * Zod schemas for the business-operations collections.
 *
 * Mirrors the interfaces in `@/types/business`. As everywhere else in this
 * codebase, these are parsed **inside the repository**, so a malformed supplier,
 * purchase order, movement, expense or cash entry can never reach Firestore
 * regardless of which caller built the payload.
 *
 * Money note: every amount uses {@link priceSchema} (non-negative, finite).
 * Direction/sign is carried by an explicit field (`direction`, `quantityChange`)
 * rather than by negative amounts, so a report can never accidentally flip a
 * number's meaning by dropping a minus sign.
 */
import { z } from 'zod';
import {
  ANALYTICS_EVENT_TYPES,
  CASH_SOURCES,
  INVENTORY_MOVEMENT_TYPES,
  PAYMENT_METHODS,
  PURCHASE_ORDER_STATUSES,
} from '@/types/business';
import {
  idSchema,
  slugSchema,
  nonEmptyString,
  priceSchema,
  currencySchema,
  firestoreDateSchema,
} from './common';

/** Who performed an action. `uid`/`email` are null for the storefront actor. */
export const actorSchema = z.object({
  uid: z.string().nullable(),
  email: z.string().nullable(),
  label: z.string().max(200).default('Unknown'),
});

/** A positive whole quantity of goods. */
const quantitySchema = z.number().int().positive().max(1_000_000);

/** A signed, non-zero whole quantity (inventory movements). */
const signedQuantitySchema = z
  .number()
  .int()
  .refine((n) => n !== 0, 'A movement must change stock by a non-zero amount')
  .refine((n) => Math.abs(n) <= 1_000_000, 'Quantity is out of range');

// ───────────────────────────── Suppliers ─────────────────────────────────────

const supplierBaseSchema = z.object({
  name: nonEmptyString.max(160),
  contactPerson: z.string().trim().max(120).default(''),
  phone: z.string().trim().max(40).default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
  address: z.string().trim().max(500).default(''),
  notes: z.string().trim().max(2000).default(''),
  active: z.boolean().default(true),
});

export const supplierCreateSchema = supplierBaseSchema;
export const supplierUpdateSchema = supplierBaseSchema.partial();

// ─────────────────────────── Purchase orders ─────────────────────────────────

export const purchaseOrderStatusSchema = z.enum(
  PURCHASE_ORDER_STATUSES as unknown as [string, ...string[]]
);

export const purchaseOrderItemSchema = z
  .object({
    productId: idSchema,
    title: nonEmptyString.max(200),
    slug: z.union([slugSchema, z.literal('')]).default(''),
    quantity: quantitySchema,
    quantityReceived: z.number().int().nonnegative().default(0),
    unitCost: priceSchema,
    lineTotal: priceSchema,
  })
  .refine((item) => item.quantityReceived <= item.quantity, {
    message: 'Received quantity cannot exceed the quantity ordered',
    path: ['quantityReceived'],
  });

const purchaseOrderBaseSchema = z.object({
  purchaseOrderNumber: nonEmptyString.max(40),
  supplierId: idSchema,
  supplierName: nonEmptyString.max(160),
  status: purchaseOrderStatusSchema.default('draft'),
  items: z.array(purchaseOrderItemSchema).min(1, 'A purchase order needs at least one item'),
  subtotal: priceSchema,
  shippingCost: priceSchema.default(0),
  taxAmount: priceSchema.default(0),
  total: priceSchema,
  currency: currencySchema,
  orderedAt: firestoreDateSchema.default(null),
  expectedDeliveryAt: firestoreDateSchema.default(null),
  actualDeliveryAt: firestoreDateSchema.default(null),
  notes: z.string().trim().max(2000).default(''),
  createdBy: actorSchema,
});

export const purchaseOrderCreateSchema = purchaseOrderBaseSchema;
export const purchaseOrderUpdateSchema = purchaseOrderBaseSchema.partial();

/** One received line inside a receipt. */
export const purchaseReceiptItemSchema = z.object({
  productId: idSchema,
  title: nonEmptyString.max(200),
  quantity: quantitySchema,
  unitCost: priceSchema,
  lineTotal: priceSchema,
  stockAfter: z.number().int().nonnegative(),
  averageCostAfter: priceSchema,
});

export const purchaseReceiptCreateSchema = z.object({
  purchaseOrderId: idSchema,
  purchaseOrderNumber: nonEmptyString.max(40),
  supplierId: idSchema,
  supplierName: nonEmptyString.max(160),
  items: z.array(purchaseReceiptItemSchema).min(1, 'Record at least one received item'),
  totalCost: priceSchema,
  currency: currencySchema,
  receivedAt: firestoreDateSchema.default(null),
  notes: z.string().trim().max(2000).default(''),
  receivedBy: actorSchema,
});

/**
 * What the receiving form submits: how many units of each PO line arrived.
 * Lines with `quantity: 0` are simply not received this time.
 */
export const receiveGoodsSchema = z.object({
  purchaseOrderId: idSchema,
  receivedAt: z.date(),
  notes: z.string().trim().max(2000).default(''),
  lines: z
    .array(
      z.object({
        productId: idSchema,
        quantity: z.number().int().nonnegative(),
        /** Allows the actual invoiced cost to differ from the ordered cost. */
        unitCost: priceSchema,
      })
    )
    .min(1),
});

// ────────────────────────── Inventory movements ──────────────────────────────

export const inventoryMovementTypeSchema = z.enum(
  INVENTORY_MOVEMENT_TYPES as unknown as [string, ...string[]]
);

export const movementReferenceSchema = z.object({
  kind: z.enum(['order', 'purchase', 'manual']),
  id: z.string().max(120).default(''),
  label: z.string().max(200).default(''),
});

export const inventoryMovementCreateSchema = z.object({
  productId: idSchema,
  productTitle: nonEmptyString.max(200),
  productSlug: z.string().max(200).default(''),
  type: inventoryMovementTypeSchema,
  quantityChange: signedQuantitySchema,
  stockAfter: z.number().int().nonnegative(),
  unitCost: priceSchema.nullable().default(null),
  totalValue: priceSchema.nullable().default(null),
  reference: movementReferenceSchema,
  reason: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(2000).default(''),
  createdBy: actorSchema,
  occurredAt: firestoreDateSchema.default(null),
});

/**
 * A manual stock adjustment as entered by an operator. `newQuantity` is the
 * absolute count they want the product to have; the delta is derived so the two
 * can never disagree. A reason is **required** — that is what makes the
 * resulting movement auditable.
 */
export const inventoryAdjustmentSchema = z
  .object({
    productId: idSchema,
    /** The stock level the operator observed, used for optimistic-conflict checks. */
    currentQuantity: z.number().int().nonnegative(),
    newQuantity: z.number().int().nonnegative().max(1_000_000),
    type: inventoryMovementTypeSchema,
    reason: nonEmptyString.max(200),
    notes: z.string().trim().max(2000).default(''),
  })
  .refine((data) => data.newQuantity !== data.currentQuantity, {
    message: 'The new quantity must differ from the current quantity',
    path: ['newQuantity'],
  });

// ──────────────────────────────── Expenses ───────────────────────────────────

export const paymentMethodSchema = z.enum(PAYMENT_METHODS as unknown as [string, ...string[]]);

const expenseCategoryBaseSchema = z.object({
  key: nonEmptyString.max(60),
  name: nonEmptyString.max(80),
  description: z.string().trim().max(300).default(''),
  isInventoryProcurement: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export const expenseCategoryCreateSchema = expenseCategoryBaseSchema;
export const expenseCategoryUpdateSchema = expenseCategoryBaseSchema.partial();

const expenseBaseSchema = z.object({
  amount: priceSchema.refine((n) => n > 0, 'An expense must be greater than zero'),
  currency: currencySchema,
  categoryId: idSchema,
  categoryName: nonEmptyString.max(80),
  isInventoryProcurement: z.boolean().default(false),
  incurredAt: firestoreDateSchema.default(null),
  paymentMethod: paymentMethodSchema.default('cash'),
  description: z.string().trim().max(500).default(''),
  reference: z.string().trim().max(120).default(''),
  attachmentUrl: z
    .union([z.url(), z.literal('')])
    .nullable()
    .default(null),
  createdBy: actorSchema,
});

export const expenseCreateSchema = expenseBaseSchema;
export const expenseUpdateSchema = expenseBaseSchema.partial();

// ────────────────────────────── Cash flow ────────────────────────────────────

export const cashSourceSchema = z.enum(CASH_SOURCES as unknown as [string, ...string[]]);

export const cashReferenceSchema = z.object({
  kind: z.enum(['order', 'purchase', 'expense', 'manual']),
  id: z.string().max(120).default(''),
  label: z.string().max(200).default(''),
});

export const cashTransactionCreateSchema = z.object({
  direction: z.enum(['inflow', 'outflow']),
  amount: priceSchema.refine((n) => n > 0, 'A cash entry must be greater than zero'),
  currency: currencySchema,
  source: cashSourceSchema,
  category: z.string().trim().max(120).default(''),
  description: z.string().trim().max(500).default(''),
  occurredAt: firestoreDateSchema.default(null),
  paymentMethod: paymentMethodSchema.default('cash'),
  reference: cashReferenceSchema,
  createdBy: actorSchema,
});

// ───────────────────────────── Analytics ─────────────────────────────────────

export const analyticsEventTypeSchema = z.enum(
  ANALYTICS_EVENT_TYPES as unknown as [string, ...string[]]
);

/**
 * A storefront event. Every string field is bounded and there is no free-form
 * blob — the shape is mirrored by the Firestore rule that lets an
 * unauthenticated visitor append events, so nothing unbounded can be written.
 */
export const analyticsEventCreateSchema = z.object({
  type: analyticsEventTypeSchema,
  sessionId: z.string().min(1).max(64),
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dayKey must be YYYY-MM-DD'),
  path: z.string().max(300).default(''),
  productId: z.string().max(120).default(''),
  productTitle: z.string().max(200).default(''),
  categoryId: z.string().max(120).default(''),
  brandId: z.string().max(120).default(''),
  searchTerm: z.string().max(120).default(''),
  resultCount: z.number().int().nonnegative().nullable().default(null),
  quantity: z.number().int().nonnegative().nullable().default(null),
  value: priceSchema.nullable().default(null),
  occurredAt: firestoreDateSchema.default(null),
});

export const analyticsDailySummarySchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counts: z.record(z.string(), z.number().nonnegative()).default({}),
  sessions: z.number().int().nonnegative().default(0),
  productViews: z.record(z.string(), z.number().nonnegative()).default({}),
  searchTerms: z.record(z.string(), z.number().nonnegative()).default({}),
  computedAt: firestoreDateSchema.default(null),
});

// ───────────────────────────── Audit log ─────────────────────────────────────

export const auditLogCreateSchema = z.object({
  action: z.string().min(1).max(60),
  entity: z.string().min(1).max(40),
  entityId: z.string().max(160).default(''),
  entityLabel: z.string().max(200).default(''),
  summary: z.string().max(500).default(''),
  before: z.record(z.string(), z.unknown()).nullable().default(null),
  after: z.record(z.string(), z.unknown()).nullable().default(null),
  actor: actorSchema,
  occurredAt: firestoreDateSchema.default(null),
});

// ─────────────────────── Order costing & delivery ────────────────────────────

export const orderCostLineSchema = z.object({
  productId: idSchema,
  title: nonEmptyString.max(200),
  quantity: z.number().int().positive(),
  unitCost: priceSchema,
  lineCost: priceSchema,
});

export const orderCostingSchema = z.object({
  method: z.literal('weighted_average'),
  lines: z.array(orderCostLineSchema),
  totalCost: priceSchema,
  complete: z.boolean(),
  capturedAt: firestoreDateSchema.default(null),
  capturedBy: actorSchema,
});

export const orderDeliverySchema = z.object({
  courier: z.string().trim().max(120).default(''),
  trackingNumber: z.string().trim().max(120).default(''),
  deliveryCost: priceSchema.default(0),
  shippedAt: firestoreDateSchema.default(null),
  expectedDeliveryAt: firestoreDateSchema.default(null),
  deliveredAt: firestoreDateSchema.default(null),
  notes: z.string().trim().max(1000).default(''),
});

// ─────────────────────────────── Types ───────────────────────────────────────

export type ActorInput = z.input<typeof actorSchema>;
export type SupplierCreateInput = z.input<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.input<typeof supplierUpdateSchema>;
export type PurchaseOrderCreateInput = z.input<typeof purchaseOrderCreateSchema>;
export type PurchaseOrderUpdateInput = z.input<typeof purchaseOrderUpdateSchema>;
export type PurchaseReceiptCreateInput = z.input<typeof purchaseReceiptCreateSchema>;
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;
export type InventoryMovementCreateInput = z.input<typeof inventoryMovementCreateSchema>;
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>;
export type ExpenseCategoryCreateInput = z.input<typeof expenseCategoryCreateSchema>;
export type ExpenseCreateInput = z.input<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.input<typeof expenseUpdateSchema>;
export type CashTransactionCreateInput = z.input<typeof cashTransactionCreateSchema>;
export type AnalyticsEventCreateInput = z.input<typeof analyticsEventCreateSchema>;
export type AuditLogCreateInput = z.input<typeof auditLogCreateSchema>;
export type OrderCostingInput = z.input<typeof orderCostingSchema>;
export type OrderDeliveryInput = z.input<typeof orderDeliverySchema>;
