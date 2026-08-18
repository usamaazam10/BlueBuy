/**
 * OrderFulfilmentService — the business operations layered onto an order after
 * the customer has placed it.
 *
 * The storefront's `orderService` stays exactly as it was: it prices a cart,
 * creates the order and decrements stock. Everything an *operator* does
 * afterwards lives here, so the checkout path is untouched by the business
 * upgrade.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Cost capture is the heart of this file.
 *
 * An order's COGS is snapshotted from each product's weighted-average cost at
 * the moment of capture, then never recomputed. That is what keeps historical
 * margin honest: buying the same product cheaper next month must not retroactively
 * improve last month's profit.
 *
 * Capture is idempotent and refuses to overwrite an existing snapshot. Products
 * with no cost basis are recorded as such — the snapshot is marked incomplete
 * rather than pretending the goods were free.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { CashRepository, OrderRepository, ProductRepository } from '@/repositories';
import type { Order, OrderStatus } from '@/types/order';
import type {
  ActorRef,
  OrderCostLine,
  OrderCosting,
  OrderDelivery,
  PaymentMethod,
} from '@/types/business';
import type { Product } from '@/types/models';
import { costBasis } from '@/lib/business/costing';
import { roundMoney, sumMoney } from '@/lib/business/metrics';
import { AppError } from '@/firebase';
import { auditService } from './audit.service';

/** What a cost-capture attempt produced. */
export interface CaptureCostsResult {
  order: Order;
  costing: OrderCosting;
  /** Lines whose product had no cost basis and were recorded as unknown. */
  missingCostLines: string[];
  /** Sale movements appended to the inventory ledger by this call. */
  movementsRecorded: number;
}

/**
 * Build a cost snapshot for an order from the current cost basis of its
 * products.
 *
 * Lines whose product is gone, or has no recorded cost, are **omitted** from
 * `lines` and the snapshot is marked incomplete. Omitting is deliberate: a line
 * with a fabricated zero cost would understate COGS and overstate profit.
 */
export function buildCosting(
  order: Order,
  products: ReadonlyMap<string, Product>,
  actor: ActorRef
): { costing: OrderCosting; missing: string[] } {
  const lines: OrderCostLine[] = [];
  const missing: string[] = [];

  for (const item of order.items) {
    const product = products.get(item.productId);
    const basis = product ? costBasis(product) : null;

    if (!basis) {
      missing.push(item.title);
      continue;
    }

    lines.push({
      productId: item.productId,
      title: item.title,
      quantity: item.quantity,
      unitCost: basis.unitCost,
      lineCost: roundMoney(basis.unitCost * item.quantity),
    });
  }

  return {
    costing: {
      method: 'weighted_average',
      lines,
      totalCost: sumMoney(lines.map((line) => line.lineCost)),
      complete: missing.length === 0 && lines.length === order.items.length,
      capturedAt: new Date(),
      capturedBy: actor,
    },
    missing,
  };
}

export const orderFulfilmentService = {
  /**
   * Capture cost of goods for an order and complete its inventory ledger.
   *
   * Runs at most once per order. Also appends the order's `sale` movements,
   * which the unauthenticated checkout cannot write itself.
   */
  async captureCosts(orderId: string, actor: ActorRef, force = false): Promise<CaptureCostsResult> {
    const order = await OrderRepository.getById(orderId);
    if (!order) throw new AppError('not-found', 'The order no longer exists.');

    // A stored snapshot that resolved no lines is not history worth protecting:
    // it records that no cost basis existed at the time. Once the operator has
    // entered real costs, re-capturing must be allowed without `force`, or the
    // order would be stuck reporting an unknown cost for ever.
    const hasCostLines = (order.costing?.lines?.length ?? 0) > 0;

    if (order.costing && hasCostLines && !force) {
      // Already costed — still make sure the ledger side is complete, since the
      // two are written by separate transactions.
      const movements = await OrderRepository.recordSaleMovements(orderId, actor);
      return {
        order,
        costing: order.costing,
        missingCostLines: [],
        movementsRecorded: movements.lines,
      };
    }

    // Fetch each distinct product once.
    const ids = [...new Set(order.items.map((item) => item.productId))];
    const fetched = await Promise.all(ids.map((id) => ProductRepository.getById(id)));
    const products = new Map<string, Product>();
    fetched.forEach((product) => {
      if (product) products.set(product.id, product);
    });

    const { costing, missing } = buildCosting(order, products, actor);
    // `force` here also covers overwriting an empty snapshot, which `applyCosting`
    // would otherwise refuse as if it were real cost history.
    const updated = await OrderRepository.applyCosting(
      orderId,
      costing,
      force || Boolean(order.costing)
    );
    const movements = await OrderRepository.recordSaleMovements(orderId, actor);

    await auditService.record({
      action: 'order.costed',
      entity: 'order',
      entityId: order.id,
      entityLabel: order.orderId,
      summary: costing.complete
        ? `Captured cost of goods for ${order.orderId}: ${costing.totalCost} ${order.currency}`
        : `Captured partial cost of goods for ${order.orderId} — no cost basis for ${missing.length} line${missing.length === 1 ? '' : 's'}`,
      actor,
      after: {
        totalCost: costing.totalCost,
        complete: costing.complete,
        missingCostLines: missing,
      },
    });

    return {
      order: updated,
      costing,
      missingCostLines: missing,
      movementsRecorded: movements.lines,
    };
  },

  /**
   * Change an order's fulfilment status, reversing inventory when the order ends
   * in a state where the goods come back.
   *
   * Cancelling or returning restocks the items — checkout took them out of stock
   * at placement, so leaving them out would permanently lose sellable inventory.
   * That path goes through {@link OrderRepository.closeWithRestock}, which moves
   * the status, the stock and the ledger entries in a **single transaction**: a
   * caller who cannot write stock changes nothing at all, rather than cancelling
   * the order and then silently failing to restock it.
   *
   * @param restock Only meaningful for `returned`. Pass false when the goods
   *   came back unsellable — the return is recorded, but the units are not put
   *   back on the shelf.
   */
  async updateStatus(
    orderId: string,
    status: OrderStatus,
    actor: ActorRef,
    restock = true
  ): Promise<Order> {
    const before = await OrderRepository.getById(orderId);
    if (!before) throw new AppError('not-found', 'The order no longer exists.');

    if (status === 'cancelled' || status === 'returned') {
      const result = await OrderRepository.closeWithRestock(
        orderId,
        status,
        actor,
        status === 'returned' ? 'Customer return' : 'Order cancelled',
        restock
      );

      await auditService.record({
        action: status === 'returned' ? 'order.returned' : 'order.status_changed',
        entity: 'order',
        entityId: result.order.id,
        entityLabel: result.order.orderId,
        summary:
          result.restoredUnits > 0
            ? `Order ${result.order.orderId}: ${before.status} → ${status}; ${result.restoredUnits} unit${result.restoredUnits === 1 ? '' : 's'} returned to stock`
            : `Order ${result.order.orderId}: ${before.status} → ${status}; no units returned to stock`,
        actor,
        before: { status: before.status },
        after: { status, restoredUnits: result.restoredUnits, restock },
      });

      return result.order;
    }

    const order = await OrderRepository.updateStatus(orderId, status);

    await auditService.record({
      action: 'order.status_changed',
      entity: 'order',
      entityId: order.id,
      entityLabel: order.orderId,
      summary: `Order ${order.orderId}: ${before.status} → ${status}`,
      actor,
      before: { status: before.status },
      after: { status },
    });

    return order;
  },

  /** Set courier and tracking details. */
  async updateDelivery(orderId: string, delivery: OrderDelivery, actor: ActorRef): Promise<Order> {
    const before = await OrderRepository.getById(orderId);
    const order = await OrderRepository.updateDelivery(orderId, delivery);

    await auditService.record({
      action: 'order.delivery_updated',
      entity: 'order',
      entityId: order.id,
      entityLabel: order.orderId,
      summary: `Updated delivery details for ${order.orderId}${delivery.courier ? ` (${delivery.courier})` : ''}`,
      actor,
      before: before?.delivery ? { ...before.delivery } : null,
      after: { ...delivery },
    });

    return order;
  },

  /**
   * Record cash received from a customer.
   *
   * Separate from the order's status: this is a cash-on-delivery business, so
   * money typically lands when the courier settles, which may be days after the
   * order is marked delivered.
   */
  async recordCustomerPayment(args: {
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    receivedAt: Date;
    actor: ActorRef;
  }): Promise<void> {
    const order = await OrderRepository.getById(args.orderId);
    if (!order) throw new AppError('not-found', 'The order no longer exists.');
    if (args.amount <= 0) {
      throw new AppError('invalid-argument', 'Enter an amount greater than zero.');
    }

    await CashRepository.create({
      direction: 'inflow',
      amount: args.amount,
      currency: order.currency,
      source: 'sale',
      category: 'Customer payment',
      description: `Payment received for order ${order.orderId}`,
      occurredAt: args.receivedAt,
      paymentMethod: args.paymentMethod,
      reference: { kind: 'order', id: order.id, label: order.orderId },
      createdBy: args.actor,
    });

    await auditService.record({
      action: 'cash.recorded',
      entity: 'order',
      entityId: order.id,
      entityLabel: order.orderId,
      summary: `Received ${args.amount} ${order.currency} for ${order.orderId}`,
      actor: args.actor,
      after: { amount: args.amount, paymentMethod: args.paymentMethod },
    });
  },

  /** Record money refunded to a customer: a cash outflow plus the order field. */
  async recordRefund(args: {
    orderId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    refundedAt: Date;
    actor: ActorRef;
  }): Promise<Order> {
    const order = await OrderRepository.getById(args.orderId);
    if (!order) throw new AppError('not-found', 'The order no longer exists.');
    if (args.amount <= 0) {
      throw new AppError('invalid-argument', 'Enter an amount greater than zero.');
    }
    if (args.amount > order.total) {
      throw new AppError('invalid-argument', 'A refund cannot exceed the order total.');
    }

    const updated = await OrderRepository.setRefund(args.orderId, args.amount);

    await CashRepository.create({
      direction: 'outflow',
      amount: args.amount,
      currency: order.currency,
      source: 'refund',
      category: 'Customer refund',
      description: `Refund for order ${order.orderId}`,
      occurredAt: args.refundedAt,
      paymentMethod: args.paymentMethod,
      reference: { kind: 'order', id: order.id, label: order.orderId },
      createdBy: args.actor,
    });

    await auditService.record({
      action: 'cash.recorded',
      entity: 'order',
      entityId: order.id,
      entityLabel: order.orderId,
      summary: `Refunded ${args.amount} ${order.currency} on ${order.orderId}`,
      actor: args.actor,
      after: { refundedAmount: args.amount },
    });

    return updated;
  },

  /** Payments already recorded against an order. */
  async listPayments(orderId: string) {
    return CashRepository.listForReference('order', orderId);
  },
};

export type OrderFulfilmentService = typeof orderFulfilmentService;
