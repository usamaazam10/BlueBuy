'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CategoryRepository } from '@/repositories';
import type { Category } from '@/types/models';
import { toStoreCategories } from '@/lib/mappers/store';
import type { StoreCategory } from '@/types/store';
import { queryKeys } from './keys';

/** Raw active-categories query. */
export function useCategoriesQuery() {
  return useQuery<Category[]>({
    queryKey: queryKeys.categories,
    queryFn: () => CategoryRepository.listActive(),
  });
}

/** Active categories mapped to storefront view models (sorted for display). */
export function useStoreCategories() {
  const query = useCategoriesQuery();
  const data = useMemo<StoreCategory[]>(
    () => (query.data ? toStoreCategories(query.data) : []),
    [query.data]
  );
  return { ...query, data };
}
