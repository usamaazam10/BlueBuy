/**
 * Build-time catalogue loader for statically-generated pages.
 *
 * The storefront is a static export, so `generateStaticParams`,
 * `generateMetadata` and the product page body all run at **build time**. Those
 * hooks are called once per product; this module memoises a single catalogue
 * read (products + categories + brands) for the whole build so the exporter hits
 * Firestore once rather than three times per page.
 *
 * The client renders the same data live via `useStoreProducts` — this is the
 * server-side twin used only during prerendering.
 */
import { ProductRepository, CategoryRepository, BrandRepository } from '@/repositories';
import { toStoreProducts } from '@/lib/mappers/store';
import type { StoreProduct } from '@/types/store';

let catalogPromise: Promise<StoreProduct[]> | null = null;

/** Best-effort read: categories/brands may be locked down by security rules;
 *  when they are, we still render products (names fall back to a humanised id). */
async function safeList<T>(fn: () => Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[catalog] optional read "${label}" failed — continuing without it:`, error);
    return [];
  }
}

async function loadCatalog(): Promise<StoreProduct[]> {
  // Products are required; categories/brands only enrich display names.
  const [products, categories, brands] = await Promise.all([
    ProductRepository.listActive(),
    safeList(() => CategoryRepository.listActive(), 'categories'),
    safeList(() => BrandRepository.listActive(), 'brands'),
  ]);
  return toStoreProducts(products, categories, brands);
}

/** All active products, mapped + memoised for the duration of the build. */
export function getStoreCatalog(): Promise<StoreProduct[]> {
  if (!catalogPromise) catalogPromise = loadCatalog();
  return catalogPromise;
}

/** A single mapped product by slug, or `null` when it doesn't exist. */
export async function getStoreProductBySlug(slug: string): Promise<StoreProduct | null> {
  const catalog = await getStoreCatalog();
  return catalog.find((product) => product.slug === slug) ?? null;
}

/** Related products: same category first, then others, excluding the product. */
export async function getRelatedStoreProducts(
  product: StoreProduct,
  limit = 4
): Promise<StoreProduct[]> {
  const catalog = await getStoreCatalog();
  const sameCategory = catalog.filter(
    (candidate) => candidate.categorySlug === product.categorySlug && candidate.id !== product.id
  );
  const others = catalog.filter(
    (candidate) => candidate.categorySlug !== product.categorySlug && candidate.id !== product.id
  );
  return [...sameCategory, ...others].slice(0, limit);
}
