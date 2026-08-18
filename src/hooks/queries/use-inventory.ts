'use client';

/**
 * Inventory hooks — the movement ledger, manual adjustments and reconciliation.
 *
 * Every mutation here changes stock, so each invalidates the product caches as
 * well as the ledger; the storefront's own product queries share those keys, so
 * an adjustment is reflected everywhere without a reload.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryService, type ReconcileResult } from '@/services/inventory.service';
import type { InventoryMovement } from '@/types/business';
import type { Product } from '@/types/models';
import type { Order } from '@/types/order';
import type { InventoryAdjustmentInput } from '@/lib/validations';
import type { DateRange } from '@/lib/business/date-range';
import type { AdjustmentResult } from '@/repositories';
import { useActor } from '@/hooks/use-actor';
import { queryKeys, rangeToken } from './keys';

/** Movements in a period, newest first. */
export function useInventoryMovementsQuery(range?: DateRange | null) {
  return useQuery<InventoryMovement[]>({
    queryKey: queryKeys.inventoryMovements(rangeToken(range)),
    queryFn: () => inventoryService.listMovements(range),
  });
}

/** Full ledger for a single product. */
export function useProductMovementsQuery(productId: string | undefined) {
  return useQuery<InventoryMovement[]>({
    queryKey: queryKeys.productMovements(productId ?? ''),
    queryFn: () => inventoryService.listProductMovements(productId as string),
    enabled: Boolean(productId),
  });
}

/** Apply a manual stock adjustment (atomic with its ledger entry). */
export function useAdjustStock() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<AdjustmentResult, Error, InventoryAdjustmentInput>({
    mutationFn: (input) => inventoryService.adjustStock(input, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      void queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

/** Set a product's manual cost basis (for stock bought before BlueBuy tracked it). */
export function useSetCostBasis() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<Product, Error, { productId: string; costPrice: number | null }>({
    mutationFn: ({ productId, costPrice }) =>
      inventoryService.setCostBasis(productId, costPrice, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

/**
 * Backfill `sale` movements for orders whose ledger entries were never posted.
 *
 * Idempotent — safe to run repeatedly; already-reconciled orders are skipped.
 */
export function useReconcileSaleMovements() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<ReconcileResult, Error, readonly Order[]>({
    mutationFn: (orders) => inventoryService.reconcileSaleMovements(orders, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}
