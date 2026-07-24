'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BrandRepository } from '@/repositories';
import type { Brand } from '@/types/models';
import { toStoreBrands } from '@/lib/mappers/store';
import type { StoreBrand } from '@/types/store';
import { queryKeys } from './keys';

/** Raw active-brands query. */
export function useBrandsQuery() {
  return useQuery<Brand[]>({
    queryKey: queryKeys.brands,
    queryFn: () => BrandRepository.listActive(),
  });
}

/** Active brands mapped to storefront view models (sorted alphabetically). */
export function useStoreBrands() {
  const query = useBrandsQuery();
  const data = useMemo<StoreBrand[]>(
    () => (query.data ? toStoreBrands(query.data) : []),
    [query.data]
  );
  return { ...query, data };
}
