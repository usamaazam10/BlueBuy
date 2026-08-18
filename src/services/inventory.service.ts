/**
 * InventoryService — stock operations and the reconciliation tool.
 *
 * Manual adjustments go through {@link adjustStock}, which is atomic with its
 * ledger entry and requires a reason. There is deliberately no "just set the
 * stock number" path anywhere in the app: stock changes are always explained.
 */
import {
  InventoryMovementRepository,
  OrderRepository,
  ProductRepository,
  type AdjustmentResult,
} from '@/repositories';
import type { ActorRef, InventoryMovement } from '@/types/business';
import type { Product } from '@/types/models';
import type { Order } from '@/types/order';
import type { InventoryAdjustmentInput } from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import { auditService } from './audit.service';

/** Outcome of backfilling sale movements across orders. */
export interface ReconcileResult {
  /** Orders that had no sale movements and now do. */
  ordersReconciled: number;
  /** Ledger entries appended. */
  movementsAdded: number;
  /** Orders skipped because they were already reconciled. */
  alreadyRecorded: number;
}

export const inventoryService = {
  /** Movements in a period. */
  async listMovements(range?: DateRange | null): Promise<InventoryMovement[]> {
    return InventoryMovementRepository.list(range);
  },

  /** Full ledger for one product. */
  async listProductMovements(productId: string): Promise<InventoryMovement[]> {
    return InventoryMovementRepository.listForProduct(productId);
  },

  /**
   * Adjust a product's stock to an absolute count, recording why.
   *
   * The adjustment and its ledger entry commit together, and the write is
   * rejected if the stock level changed while the operator was typing.
   */
  async adjustStock(input: InventoryAdjustmentInput, actor: ActorRef): Promise<AdjustmentResult> {
    const result = await InventoryMovementRepository.adjust(input, actor);

    const direction = result.quantityChange > 0 ? 'increased' : 'decreased';
    await auditService.record({
      action: 'inventory.adjusted',
      entity: 'product',
      entityId: result.productId,
      entityLabel: result.productTitle,
      summary: `Stock ${direction} from ${result.previousStock} to ${result.newStock} (${input.type}) — ${input.reason}`,
      actor,
      before: { stock: result.previousStock },
      after: {
        stock: result.newStock,
        change: result.quantityChange,
        type: input.type,
        reason: input.reason,
        notes: input.notes,
      },
    });

    return result;
  },

  /**
   * Set a product's cost fields directly.
   *
   * This is the honest way to open a cost basis for stock that was bought before
   * BlueBuy tracked purchases. Once the product is received on a purchase order,
   * the weighted average takes over and this value stops being consulted.
   */
  async setCostBasis(
    productId: string,
    costPrice: number | null,
    actor: ActorRef
  ): Promise<Product> {
    const before = await ProductRepository.getById(productId);
    const product = await ProductRepository.update(productId, { costPrice });

    await auditService.record({
      action: 'product.updated',
      entity: 'product',
      entityId: productId,
      entityLabel: product.title,
      summary:
        costPrice === null
          ? `Cleared the manual cost for “${product.title}”`
          : `Set the manual unit cost for “${product.title}” to ${costPrice}`,
      actor,
      before: { costPrice: before?.costPrice ?? null },
      after: { costPrice },
    });

    return product;
  },

  /**
   * Backfill `sale` movements for orders placed before the ledger existed (or
   * whose movements were never posted).
   *
   * Idempotent: each order carries a `saleMovementsRecorded` flag set inside the
   * same transaction that writes its movements, so re-running this can never
   * double-post. Cancelled orders are skipped — their stock was returned rather
   * than sold, and the cancellation path writes its own movement.
   */
  async reconcileSaleMovements(
    orders: readonly Order[],
    actor: ActorRef
  ): Promise<ReconcileResult> {
    let ordersReconciled = 0;
    let movementsAdded = 0;
    let alreadyRecorded = 0;

    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      if (order.saleMovementsRecorded) {
        alreadyRecorded += 1;
        continue;
      }

      const result = await OrderRepository.recordSaleMovements(order.id, actor);
      if (result.recorded) {
        ordersReconciled += 1;
        movementsAdded += result.lines;
      } else {
        alreadyRecorded += 1;
      }
    }

    if (ordersReconciled > 0) {
      await auditService.record({
        action: 'inventory.adjusted',
        entity: 'inventory',
        entityId: 'reconcile',
        entityLabel: 'Sale movement reconciliation',
        summary: `Backfilled ${movementsAdded} sale movement${movementsAdded === 1 ? '' : 's'} across ${ordersReconciled} order${ordersReconciled === 1 ? '' : 's'}`,
        actor,
        after: { ordersReconciled, movementsAdded },
      });
    }

    return { ordersReconciled, movementsAdded, alreadyRecorded };
  },
};

export type InventoryService = typeof inventoryService;
