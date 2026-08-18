/**
 * PurchaseService — procurement orchestration.
 *
 * Owns the *business* rules around buying stock, while `PurchaseRepository`
 * owns the Firestore access:
 *  - pricing a purchase order (line totals, shipping, tax, grand total),
 *  - generating the human-facing PO number,
 *  - receiving goods and then recording the audit entry,
 *  - recording a supplier **payment**, which is a separate event from receiving.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Receiving goods ≠ paying for them.
 *
 * Receiving raises stock and establishes cost basis. Paying moves cash. They
 * frequently happen days apart, and conflating them would make the cash balance
 * wrong. So {@link receiveGoods} writes no cash entry, and {@link recordPayment}
 * writes no stock. Both are recorded against the same purchase order.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  CashRepository,
  PurchaseRepository,
  SupplierRepository,
  type ReceiveResult,
} from '@/repositories';
import type {
  ActorRef,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseReceipt,
  Supplier,
} from '@/types/business';
import type { PaymentMethod } from '@/types/business';
import type {
  ReceiveGoodsInput,
  SupplierCreateInput,
  SupplierUpdateInput,
} from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import { roundMoney, sumMoney } from '@/lib/business/metrics';
import { generateDocumentNumber } from '@/repositories/shared';
import { AppError } from '@/firebase';
import { auditService } from './audit.service';

/** A line as captured by the purchase-order form, before pricing. */
export interface DraftPurchaseLine {
  productId: string;
  title: string;
  slug: string;
  quantity: number;
  unitCost: number;
}

/** Everything the purchase-order form collects. */
export interface CreatePurchaseOrderArgs {
  supplierId: string;
  lines: DraftPurchaseLine[];
  shippingCost: number;
  taxAmount: number;
  currency: string;
  expectedDeliveryAt: Date | null;
  notes: string;
  /** Raise it straight into `ordered`, rather than leaving a draft. */
  placeImmediately: boolean;
  actor: ActorRef;
}

/** Price a set of draft lines into stored purchase-order items. */
export function priceLines(lines: readonly DraftPurchaseLine[]): {
  items: PurchaseOrderItem[];
  subtotal: number;
} {
  const items = lines.map<PurchaseOrderItem>((line) => ({
    productId: line.productId,
    title: line.title,
    slug: line.slug,
    quantity: line.quantity,
    quantityReceived: 0,
    unitCost: line.unitCost,
    lineTotal: roundMoney(line.unitCost * line.quantity),
  }));
  return { items, subtotal: sumMoney(items.map((item) => item.lineTotal)) };
}

export const purchaseService = {
  /** Suppliers for the picker (active only). */
  async listSuppliers(activeOnly = false): Promise<Supplier[]> {
    return activeOnly ? SupplierRepository.listActive() : SupplierRepository.list();
  },

  async getSupplier(id: string): Promise<Supplier | null> {
    return SupplierRepository.getById(id);
  },

  /** Create a supplier. */
  async createSupplier(input: SupplierCreateInput, actor: ActorRef): Promise<Supplier> {
    const supplier = await SupplierRepository.create(input);
    await auditService.record({
      action: 'supplier.created',
      entity: 'supplier',
      entityId: supplier.id,
      entityLabel: supplier.name,
      summary: `Added supplier “${supplier.name}”`,
      actor,
      after: {
        name: supplier.name,
        contactPerson: supplier.contactPerson,
        active: supplier.active,
      },
    });
    return supplier;
  },

  /** Update a supplier. */
  async updateSupplier(id: string, input: SupplierUpdateInput, actor: ActorRef): Promise<Supplier> {
    const before = await SupplierRepository.getById(id);
    const supplier = await SupplierRepository.update(id, input);
    await auditService.record({
      action: 'supplier.updated',
      entity: 'supplier',
      entityId: supplier.id,
      entityLabel: supplier.name,
      summary: `Updated supplier “${supplier.name}”`,
      actor,
      before: before ? { ...before } : null,
      after: { ...supplier },
    });
    return supplier;
  },

  /**
   * Delete a supplier. Refused by the repository while purchase orders
   * reference it, so procurement history can never be orphaned.
   */
  async deleteSupplier(id: string, actor: ActorRef): Promise<void> {
    const supplier = await SupplierRepository.getById(id);
    await SupplierRepository.remove(id);
    await auditService.record({
      action: 'supplier.updated',
      entity: 'supplier',
      entityId: id,
      entityLabel: supplier?.name ?? 'Supplier',
      summary: `Deleted supplier “${supplier?.name ?? id}”`,
      actor,
      before: supplier ? { name: supplier.name } : null,
    });
  },

  /** Purchase orders in a period. */
  async list(range?: DateRange | null): Promise<PurchaseOrder[]> {
    return PurchaseRepository.list(range);
  },

  async getById(id: string): Promise<PurchaseOrder | null> {
    return PurchaseRepository.getById(id);
  },

  /** Receipts against a purchase order. */
  async listReceiptsFor(purchaseOrderId: string): Promise<PurchaseReceipt[]> {
    return PurchaseRepository.listReceiptsFor(purchaseOrderId);
  },

  /** All receipts in a period — the basis for purchase reporting. */
  async listReceipts(range?: DateRange | null): Promise<PurchaseReceipt[]> {
    return PurchaseRepository.listReceipts(range);
  },

  /**
   * Create a purchase order. Prices the lines, stamps a PO number, snapshots the
   * supplier's name, and writes it. **Changes no stock** — goods have not
   * arrived.
   */
  async create(args: CreatePurchaseOrderArgs): Promise<PurchaseOrder> {
    if (args.lines.length === 0) {
      throw new AppError('invalid-argument', 'Add at least one product to the purchase order.');
    }

    const supplier = await SupplierRepository.getById(args.supplierId);
    if (!supplier) {
      throw new AppError('not-found', 'That supplier no longer exists.');
    }

    const { items, subtotal } = priceLines(args.lines);
    const total = roundMoney(subtotal + args.shippingCost + args.taxAmount);
    const number = generateDocumentNumber('PO');
    const status: PurchaseOrderStatus = args.placeImmediately ? 'ordered' : 'draft';

    const order = await PurchaseRepository.create(number, {
      purchaseOrderNumber: number,
      supplierId: supplier.id,
      supplierName: supplier.name,
      status,
      items,
      subtotal,
      shippingCost: args.shippingCost,
      taxAmount: args.taxAmount,
      total,
      currency: args.currency,
      orderedAt: args.placeImmediately ? new Date() : null,
      expectedDeliveryAt: args.expectedDeliveryAt,
      actualDeliveryAt: null,
      notes: args.notes,
      createdBy: args.actor,
    });

    await auditService.record({
      action: 'purchase.created',
      entity: 'purchase_order',
      entityId: order.id,
      entityLabel: order.purchaseOrderNumber,
      summary: `Raised ${number} with ${supplier.name} for ${items.length} line${items.length === 1 ? '' : 's'} (${total} ${args.currency})`,
      actor: args.actor,
      after: { status, supplier: supplier.name, total, items: items.length },
    });

    return order;
  },

  /** Move a purchase order through the statuses an operator drives directly. */
  async updateStatus(
    id: string,
    status: PurchaseOrderStatus,
    actor: ActorRef
  ): Promise<PurchaseOrder> {
    const before = await PurchaseRepository.getById(id);
    const order = await PurchaseRepository.updateStatus(id, status);

    await auditService.record({
      action: status === 'cancelled' ? 'purchase.cancelled' : 'purchase.updated',
      entity: 'purchase_order',
      entityId: order.id,
      entityLabel: order.purchaseOrderNumber,
      summary: `Purchase order ${order.purchaseOrderNumber} moved to “${status}”`,
      actor,
      before: before ? { status: before.status } : null,
      after: { status },
    });

    return order;
  },

  /**
   * Record goods received. Raises stock, updates the weighted-average cost,
   * appends inventory movements and writes an immutable receipt — all atomically
   * inside the repository.
   */
  async receiveGoods(input: ReceiveGoodsInput, actor: ActorRef): Promise<ReceiveResult> {
    const result = await PurchaseRepository.receive(input, actor);

    const unitCount = result.lines.reduce((sum, line) => sum + line.quantity, 0);
    await auditService.record({
      action: 'purchase.received',
      entity: 'purchase_order',
      entityId: result.purchaseOrder.id,
      entityLabel: result.purchaseOrder.purchaseOrderNumber,
      summary: `Received ${unitCount} unit${unitCount === 1 ? '' : 's'} against ${result.purchaseOrder.purchaseOrderNumber} (${result.totalCost})${result.fullyReceived ? ' — order complete' : ' — partial receipt'}`,
      actor,
      after: {
        receiptId: result.receiptId,
        units: unitCount,
        totalCost: result.totalCost,
        status: result.purchaseOrder.status,
        lines: result.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          averageCostAfter: line.averageCostAfter,
        })),
      },
    });

    return result;
  },

  /**
   * Record a payment made to a supplier for a purchase order.
   *
   * This is the cash side of procurement and is intentionally decoupled from
   * receiving: money often moves before or after the goods do.
   */
  async recordPayment(args: {
    purchaseOrderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paidAt: Date;
    description?: string;
    actor: ActorRef;
  }): Promise<void> {
    const order = await PurchaseRepository.getById(args.purchaseOrderId);
    if (!order) throw new AppError('not-found', 'That purchase order no longer exists.');
    if (args.amount <= 0) {
      throw new AppError('invalid-argument', 'Enter an amount greater than zero.');
    }

    await CashRepository.create({
      direction: 'outflow',
      amount: args.amount,
      currency: order.currency,
      source: 'purchase',
      category: `Supplier: ${order.supplierName}`,
      description: args.description || `Payment for purchase order ${order.purchaseOrderNumber}`,
      occurredAt: args.paidAt,
      paymentMethod: args.paymentMethod,
      reference: {
        kind: 'purchase',
        id: order.id,
        label: order.purchaseOrderNumber,
      },
      createdBy: args.actor,
    });

    await auditService.record({
      action: 'cash.recorded',
      entity: 'purchase_order',
      entityId: order.id,
      entityLabel: order.purchaseOrderNumber,
      summary: `Paid ${args.amount} ${order.currency} to ${order.supplierName} for ${order.purchaseOrderNumber}`,
      actor: args.actor,
      after: { amount: args.amount, paymentMethod: args.paymentMethod },
    });
  },

  /** Payments already recorded against a purchase order. */
  async listPayments(purchaseOrderId: string) {
    return CashRepository.listForReference('purchase', purchaseOrderId);
  },
};

export type PurchaseService = typeof purchaseService;
