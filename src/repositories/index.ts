/**
 * Repository layer — the only place that reads from / writes to Firestore.
 *
 * Import from `@/repositories`. Components and features must go through these
 * repositories rather than touching the Firestore SDK directly, so data access,
 * validation, and error handling live in exactly one place.
 */
export {
  ProductRepository,
  type ProductRepositoryType,
  type ListProductsOptions,
} from './product.repository';

export { CategoryRepository, type CategoryRepositoryType } from './category.repository';

export { BrandRepository, type BrandRepositoryType } from './brand.repository';

export { OrderRepository, type OrderRepositoryType } from './order.repository';

export {
  OrphanedAssetRepository,
  type OrphanedAssetRepositoryType,
} from './orphaned-asset.repository';

// ── Business operations ──
export { SupplierRepository, type SupplierRepositoryType } from './supplier.repository';

export {
  PurchaseRepository,
  type PurchaseRepositoryType,
  type ReceiveResult,
} from './purchase.repository';

export {
  InventoryMovementRepository,
  type InventoryMovementRepositoryType,
  type AdjustmentResult,
} from './inventory-movement.repository';

export {
  ExpenseRepository,
  ExpenseCategoryRepository,
  CashRepository,
  type ExpenseRepositoryType,
  type ExpenseCategoryRepositoryType,
  type CashRepositoryType,
} from './finance.repository';

export { AuditLogRepository, type AuditLogRepositoryType } from './audit-log.repository';

export {
  SiteSettingsRepository,
  HomepageRepository,
  FooterRepository,
  ContactRepository,
  NavigationRepository,
  BannerRepository,
  SocialLinkRepository,
  type SiteSettingsRepositoryType,
  type HomepageRepositoryType,
  type FooterRepositoryType,
  type ContactRepositoryType,
  type NavigationRepositoryType,
  type BannerRepositoryType,
  type SocialLinkRepositoryType,
} from './cms.repository';
