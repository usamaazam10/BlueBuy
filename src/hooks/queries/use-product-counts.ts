'use client';

/**
 * Live product counts for the admin (all products, active + inactive), grouped
 * by category and brand. Backs the "(N products)" chips in the category/brand
 * managers. The category/brand delete-safety guard queries an authoritative
 * count directly (see `ProductRepository.countByCategory`); these cached counts
 * are for display only.
 */
import { useQuery } from '@tanstack/react-query';
import { ProductRepository } from '@/repositories';
import { computeProductCounts, type ProductCounts } from '@/lib/product-counts';
import type { Product } from '@/types/models';
import { queryKeys } from './keys';

export function useProductCounts() {
  const query = useQuery<Product[]>({
    queryKey: queryKeys.allProducts,
    queryFn: () => ProductRepository.list(),
  });

  const counts: ProductCounts = computeProductCounts(query.data ?? []);

  return { ...counts, isLoading: query.isLoading, isError: query.isError };
}
