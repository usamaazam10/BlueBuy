'use client';

/** Raw active-products query. Prefer `useStoreProducts` for UI consumption. */
import { useQuery } from '@tanstack/react-query';
import { ProductRepository } from '@/repositories';
import type { Product } from '@/types/models';
import { queryKeys } from './keys';

export function useProductsQuery() {
  return useQuery<Product[]>({
    queryKey: queryKeys.products,
    queryFn: () => ProductRepository.listActive(),
  });
}
