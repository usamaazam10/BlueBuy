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
