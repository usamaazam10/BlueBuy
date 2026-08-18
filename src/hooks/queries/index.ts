/**
 * Storefront data hooks (React Query).
 *
 * Import query hooks from `@/hooks/queries`. These are the only place the
 * storefront UI touches the repository layer; components never call repositories
 * or Firestore directly.
 */
export { queryKeys, rangeToken } from './keys';
export { useProductsQuery } from './use-products';
export { useProductCounts } from './use-product-counts';
export { useCategoriesQuery, useStoreCategories } from './use-categories';
export { useBrandsQuery, useStoreBrands } from './use-brands';
export { useStoreProducts } from './use-store-products';
export {
  useOrdersQuery,
  useOrdersInRange,
  useOrderQuery,
  usePlaceOrder,
  useUpdateOrderStatus,
} from './use-orders';
// ── Business operations ──
export {
  useSuppliersQuery,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  usePurchaseOrdersQuery,
  usePurchaseOrderQuery,
  usePurchaseReceiptsQuery,
  useReceiptsForOrder,
  usePurchasePaymentsQuery,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrderStatus,
  useReceiveGoods,
  useRecordSupplierPayment,
} from './use-purchases';

export {
  useInventoryMovementsQuery,
  useProductMovementsQuery,
  useAdjustStock,
  useSetCostBasis,
  useReconcileSaleMovements,
} from './use-inventory';

export {
  useExpenseCategoriesQuery,
  useExpensesQuery,
  useCashTransactionsQuery,
  useCashLedgerQuery,
  useSeedExpenseCategories,
  useCreateExpenseCategory,
  useRecordExpense,
  useDeleteExpense,
  useRecordCash,
} from './use-finance';

export {
  useCaptureOrderCosts,
  useFulfilOrderStatus,
  useUpdateOrderDelivery,
  useOrderPaymentsQuery,
  useRecordCustomerPayment,
  useRecordRefund,
} from './use-fulfilment';

export { useAuditLogQuery, useEntityAuditQuery } from './use-audit';

export { useAnalyticsWindow, useRebuildAnalyticsSummaries } from './use-analytics';

export {
  useSiteSettings,
  useHomepage,
  useFooterContent,
  useContactInformation,
  useNavigationItems,
  useSocialLinksList,
  useActiveBanners,
} from './use-cms';
