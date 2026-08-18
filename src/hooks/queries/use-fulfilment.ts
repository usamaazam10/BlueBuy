'use client';

/**
 * Order fulfilment hooks — cost capture, delivery, payments and refunds.
 *
 * These sit alongside `use-orders.ts` rather than replacing it: the storefront's
 * checkout still uses `usePlaceOrder`, untouched. Everything here is admin-only
 * and runs after an order exists.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  orderFulfilmentService,
  type CaptureCostsResult,
} from '@/services/order-fulfilment.service';
import type { Order, OrderStatus } from '@/types/order';
import type { OrderDelivery, PaymentMethod } from '@/types/business';
import { useActor } from '@/hooks/use-actor';
import { queryKeys } from './keys';

/** Invalidate everything an order-level mutation can affect. */
function useOrderInvalidation() {
  const queryClient = useQueryClient();
  return (orderId?: string) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    if (orderId) void queryClient.invalidateQueries({ queryKey: queryKeys.order(orderId) });
    void queryClient.invalidateQueries({ queryKey: ['audit_logs'] });
  };
}

/**
 * Capture cost of goods for an order, and complete its inventory ledger.
 *
 * Also invalidates products and movements: capturing costs posts the order's
 * `sale` movements, which the unauthenticated checkout could not write.
 */
export function useCaptureOrderCosts() {
  const queryClient = useQueryClient();
  const invalidate = useOrderInvalidation();
  const actor = useActor();

  return useMutation<CaptureCostsResult, Error, { orderId: string; force?: boolean }>({
    mutationFn: ({ orderId, force }) =>
      orderFulfilmentService.captureCosts(orderId, actor, force ?? false),
    onSuccess: (result) => {
      invalidate(result.order.id);
      void queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
    },
  });
}

/**
 * Change an order's fulfilment status.
 *
 * The only path that may close an order as cancelled/returned: it moves the
 * status, the stock and the ledger entries in one transaction. `restock: false`
 * records a return whose goods came back unsellable — the sale is still
 * ledgered, but the units are not put back on the shelf. `useUpdateOrderStatus`
 * refuses those two statuses outright.
 */
export function useFulfilOrderStatus() {
  const queryClient = useQueryClient();
  const invalidate = useOrderInvalidation();
  const actor = useActor();

  return useMutation<Order, Error, { id: string; status: OrderStatus; restock?: boolean }>({
    mutationFn: ({ id, status, restock }) =>
      orderFulfilmentService.updateStatus(id, status, actor, restock ?? true),
    onSuccess: (order) => {
      invalidate(order.id);
      // Cancel/return restocks, so the catalogue and ledger both moved.
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
      void queryClient.invalidateQueries({ queryKey: ['inventory_movements'] });
    },
  });
}

export function useUpdateOrderDelivery() {
  const invalidate = useOrderInvalidation();
  const actor = useActor();
  return useMutation<Order, Error, { id: string; delivery: OrderDelivery }>({
    mutationFn: ({ id, delivery }) => orderFulfilmentService.updateDelivery(id, delivery, actor),
    onSuccess: (order) => invalidate(order.id),
  });
}

export function useOrderPaymentsQuery(orderId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.orderPayments(orderId ?? ''),
    queryFn: () => orderFulfilmentService.listPayments(orderId as string),
    enabled: Boolean(orderId),
  });
}

export function useRecordCustomerPayment() {
  const queryClient = useQueryClient();
  const invalidate = useOrderInvalidation();
  const actor = useActor();

  return useMutation<
    void,
    Error,
    { orderId: string; amount: number; paymentMethod: PaymentMethod; receivedAt: Date }
  >({
    mutationFn: (args) => orderFulfilmentService.recordCustomerPayment({ ...args, actor }),
    onSuccess: (_data, variables) => {
      invalidate(variables.orderId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.orderPayments(variables.orderId) });
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
    },
  });
}

export function useRecordRefund() {
  const queryClient = useQueryClient();
  const invalidate = useOrderInvalidation();
  const actor = useActor();

  return useMutation<
    Order,
    Error,
    { orderId: string; amount: number; paymentMethod: PaymentMethod; refundedAt: Date }
  >({
    mutationFn: (args) => orderFulfilmentService.recordRefund({ ...args, actor }),
    onSuccess: (order) => {
      invalidate(order.id);
      void queryClient.invalidateQueries({ queryKey: ['cash_transactions'] });
    },
  });
}
