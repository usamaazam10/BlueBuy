'use client';

/**
 * Order data hooks (React Query).
 *
 * The only place the UI touches the order service. Reads (admin list, single
 * order) are cached queries; writes (place order, update status) are mutations
 * that invalidate the relevant caches on success. Placing an order also
 * invalidates `products`, since the transaction decremented stock.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { orderService, type PlaceOrderArgs } from '@/services/order.service';
import type { Order, OrderStatus } from '@/types/order';
import { queryKeys } from './keys';

/** All orders, newest first (admin). */
export function useOrdersQuery() {
  return useQuery<Order[]>({
    queryKey: queryKeys.orders,
    queryFn: () => orderService.list(),
  });
}

/** A single order by id/number. Disabled until an id is provided. */
export function useOrderQuery(id: string | undefined) {
  return useQuery<Order | null>({
    queryKey: queryKeys.order(id ?? ''),
    queryFn: () => orderService.getById(id as string),
    enabled: Boolean(id),
  });
}

/** Place an order (checkout). Invalidates orders + products on success. */
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation<Order, Error, PlaceOrderArgs>({
    mutationFn: (args) => orderService.placeOrder(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      // Stock changed — refresh the catalogue caches.
      void queryClient.invalidateQueries({ queryKey: queryKeys.products });
    },
  });
}

/** Update an order's status (admin). Invalidates the list + that order. */
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation<Order, Error, { id: string; status: OrderStatus }>({
    mutationFn: ({ id, status }) => orderService.updateStatus(id, status),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      void queryClient.invalidateQueries({ queryKey: queryKeys.order(order.id) });
    },
  });
}
