'use client';

import { useCallback, useMemo } from 'react';
import { toStoreProducts } from '@/lib/mappers/store';
import type { StoreProduct } from '@/types/store';
import { useProductsQuery } from './use-products';
import { useCategoriesQuery } from './use-categories';
import { useBrandsQuery } from './use-brands';

/**
 * The storefront's single source of catalogue truth.
 *
 * Composes the products, categories and brands queries and maps them into
 * display-ready `StoreProduct[]` (a product needs its category/brand docs to
 * resolve names). Everything the storefront shows — featured, filters, search,
 * related products — is derived client-side from this one cached list, so the
 * whole catalogue is fetched at most once and reused everywhere.
 */
export function useStoreProducts() {
  const productsQuery = useProductsQuery();
  const categoriesQuery = useCategoriesQuery();
  const brandsQuery = useBrandsQuery();

  const data = useMemo<StoreProduct[]>(() => {
    if (!productsQuery.data) return [];
    return toStoreProducts(productsQuery.data, categoriesQuery.data ?? [], brandsQuery.data ?? []);
  }, [productsQuery.data, categoriesQuery.data, brandsQuery.data]);

  const refetch = useCallback(() => {
    void productsQuery.refetch();
    void categoriesQuery.refetch();
    void brandsQuery.refetch();
  }, [productsQuery, categoriesQuery, brandsQuery]);

  return {
    data,
    // Products are the required collection; categories/brands only enrich
    // display names. Wait for the others to settle (loaded OR failed) so names
    // don't flash, but a denied category/brand read must never fail the whole
    // storefront — only a products failure surfaces as an error.
    isLoading: productsQuery.isLoading || categoriesQuery.isLoading || brandsQuery.isLoading,
    isError: productsQuery.isError,
    error: productsQuery.error ?? null,
    refetch,
  };
}
