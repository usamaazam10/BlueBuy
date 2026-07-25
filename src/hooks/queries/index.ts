/**
 * Storefront data hooks (React Query).
 *
 * Import query hooks from `@/hooks/queries`. These are the only place the
 * storefront UI touches the repository layer; components never call repositories
 * or Firestore directly.
 */
export { queryKeys } from './keys';
export { useProductsQuery } from './use-products';
export { useCategoriesQuery, useStoreCategories } from './use-categories';
export { useBrandsQuery, useStoreBrands } from './use-brands';
export { useStoreProducts } from './use-store-products';
export { useOrdersQuery, useOrderQuery, usePlaceOrder, useUpdateOrderStatus } from './use-orders';
export {
  useSiteSettings,
  useHomepage,
  useFooterContent,
  useContactInformation,
  useNavigationItems,
  useSocialLinksList,
  useActiveBanners,
} from './use-cms';
