'use client';

/**
 * Procurement data hooks — suppliers, purchase orders, receiving.
 *
 * The only place the UI touches `purchaseService`. Receiving goods invalidates
 * far more than the purchase order itself: it changes stock, cost basis and the
 * inventory ledger, so products and movements are invalidated too. Getting that
 * wrong would leave the dashboard showing pre-receipt stock until a manual
 * refresh — which is exactly the kind of quiet inconsistency this layer exists
 * to prevent.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseService, type CreatePurchaseOrderArgs } from '@/services/purchase.service';
import type {
  PurchaseOrder,
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
import type { ReceiveResult } from '@/repositories';
import { useActor } from '@/hooks/use-actor';
import { queryKeys, rangeToken } from './keys';

// ───────────────────────────── Suppliers ─────────────────────────────────────

export function useSuppliersQuery(activeOnly = false) {
  return useQuery<Supplier[]>({
    queryKey: [...queryKeys.suppliers, activeOnly ? 'active' : 'all'],
    queryFn: () => purchaseService.listSuppliers(activeOnly),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<Supplier, Error, SupplierCreateInput>({
    mutationFn: (input) => purchaseService.createSupplier(input, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<Supplier, Error, { id: string; input: SupplierUpdateInput }>({
    mutationFn: ({ id, input }) => purchaseService.updateSupplier(id, input, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<void, Error, string>({
    mutationFn: (id) => purchaseService.deleteSupplier(id, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
    },
  });
}

// ─────────────────────────── Purchase orders ─────────────────────────────────

export function usePurchaseOrdersQuery(range?: DateRange | null) {
  return useQuery<PurchaseOrder[]>({
    queryKey: queryKeys.purchaseOrders(rangeToken(range)),
    queryFn: () => purchaseService.list(range),
  });
}

export function usePurchaseOrderQuery(id: string | undefined) {
  return useQuery<PurchaseOrder | null>({
    queryKey: queryKeys.purchaseOrder(id ?? ''),
    queryFn: () => purchaseService.getById(id as string),
    enabled: Boolean(id),
  });
}

export function usePurchaseReceiptsQuery(range?: DateRange | null) {
  return useQuery<PurchaseReceipt[]>({
    queryKey: queryKeys.purchaseReceipts(rangeToken(range)),
    queryFn: () => purchaseService.listReceipts(range),
  });
}

export function useReceiptsForOrder(purchaseOrderId: string | undefined) {
  return useQuery<PurchaseReceipt[]>({
    queryKey: queryKeys.purchaseReceiptsFor(purchaseOrderId ?? ''),
    queryFn: () => purchaseService.listReceiptsFor(purchaseOrderId as string),
    enabled: Boolean(purchaseOrderId),
  });
}

export function usePurchasePaymentsQuery(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.purchasePayments(purchaseOrderId ?? ''),
    queryFn: () => purchaseService.listPayments(purchaseOrderId as string),
    enabled: Boolean(purchaseOrderId),
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<PurchaseOrder, Error, Omit<CreatePurchaseOrderArgs, 'actor'>>({
    mutationFn: (args) => purchaseService.create({ ...args, actor }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<PurchaseOrder, Error, { id: string; status: PurchaseOrderStatus }>({
    mutationFn: ({ id, status }) => purchaseService.updateStatus(id, status, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

/**
 * Receive goods against a purchase order.
 *
 * Invalidates every cache the receipt touched: the purchase order and its
 * receipts, the product catalogue (stock + cost basis changed), and the
 * inventory ledger.
 */
export function useReceiveGoods() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<ReceiveResult, Error, ReceiveGoodsInput>({
    mutationFn: (input) => purchaseService.receiveGoods(input, actor),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      void queryClient.invalidateQueries({ queryKey: ['purchase_receipts'] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      void queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}

export function useRecordSupplierPayment() {
  const queryClient = useQueryClient();
  const actor = useActor();
  return useMutation<
    void,
    Error,
    {
      purchaseOrderId: string;
      amount: number;
      paymentMethod: PaymentMethod;
      paidAt: Date;
      description?: string;
    }
  >({
    mutationFn: (args) => purchaseService.recordPayment({ ...args, actor }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.purchasePayments(variables.purchaseOrderId),
      });
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
      void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
    },
  });
}
