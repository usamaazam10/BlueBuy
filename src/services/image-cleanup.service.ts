/**
 * Image cleanup service.
 *
 * The storefront ships as a static export with no server runtime and no
 * Cloudinary API secret, so it cannot delete Cloudinary assets directly (destroy
 * requires a *signed* Admin API call). Instead, whenever a document that owns
 * Cloudinary media is deleted — or its image is replaced — this service records
 * the affected `public_id`s in the `orphaned_assets` ledger so an operator can
 * reconcile Cloudinary from the admin (see `/admin/orphaned-assets`).
 *
 * These functions are the orchestration layer used by the admin managers: they
 * keep the repositories thin (delete only) while ensuring no asset is silently
 * lost. Recording happens *after* the Firestore delete succeeds, so a failed
 * delete never leaves a premature "orphan" in the ledger.
 */
import {
  ProductRepository,
  CategoryRepository,
  BrandRepository,
  OrphanedAssetRepository,
} from '@/repositories';
import type { OrphanedAssetCreateInput } from '@/lib/validations';
import type { Brand, Category, Product } from '@/types/models';

/** Extract every Cloudinary `public_id` a product's gallery references. */
export function productAssets(product: Product): OrphanedAssetCreateInput[] {
  return product.gallery
    .filter((image) => image.publicId)
    .map((image) => ({
      publicId: image.publicId,
      url: image.url,
      sourceType: 'product' as const,
      sourceId: product.id,
      sourceLabel: product.title,
      cleaned: false,
    }));
}

/** Extract a category's image asset, if it has one backed by Cloudinary. */
export function categoryAssets(category: Category): OrphanedAssetCreateInput[] {
  if (!category.imagePublicId) return [];
  return [
    {
      publicId: category.imagePublicId,
      url: category.image ?? '',
      sourceType: 'category',
      sourceId: category.id,
      sourceLabel: category.name,
      cleaned: false,
    },
  ];
}

/** Extract a brand's logo asset, if it has one backed by Cloudinary. */
export function brandAssets(brand: Brand): OrphanedAssetCreateInput[] {
  if (!brand.logoPublicId) return [];
  return [
    {
      publicId: brand.logoPublicId,
      url: brand.logo ?? '',
      sourceType: 'brand',
      sourceId: brand.id,
      sourceLabel: brand.name,
      cleaned: false,
    },
  ];
}

/**
 * Record a single asset that is being *replaced* (the document lives on, but its
 * previous Cloudinary image is no longer referenced). No-op when there is no
 * previous publicId or it is unchanged.
 */
export async function recordReplacedAsset(
  sourceType: OrphanedAssetCreateInput['sourceType'],
  sourceId: string,
  sourceLabel: string,
  previousPublicId: string | null | undefined,
  previousUrl: string | null | undefined,
  nextPublicId: string | null | undefined
): Promise<void> {
  if (!previousPublicId || previousPublicId === nextPublicId) return;
  await OrphanedAssetRepository.record([
    {
      publicId: previousPublicId,
      url: previousUrl ?? '',
      sourceType,
      sourceId,
      sourceLabel,
      cleaned: false,
    },
  ]);
}

/** Delete a product and record its gallery images for Cloudinary cleanup. */
export async function deleteProductWithImageCleanup(id: string): Promise<void> {
  const product = await ProductRepository.getById(id);
  await ProductRepository.remove(id);
  if (product) await OrphanedAssetRepository.record(productAssets(product));
}

/** Delete a category and record its image for Cloudinary cleanup. */
export async function deleteCategoryWithImageCleanup(id: string): Promise<void> {
  const category = await CategoryRepository.getById(id);
  await CategoryRepository.remove(id);
  if (category) await OrphanedAssetRepository.record(categoryAssets(category));
}

/** Delete a brand and record its logo for Cloudinary cleanup. */
export async function deleteBrandWithImageCleanup(id: string): Promise<void> {
  const brand = await BrandRepository.getById(id);
  await BrandRepository.remove(id);
  if (brand) await OrphanedAssetRepository.record(brandAssets(brand));
}

export const imageCleanupService = {
  productAssets,
  categoryAssets,
  brandAssets,
  recordReplacedAsset,
  deleteProductWithImageCleanup,
  deleteCategoryWithImageCleanup,
  deleteBrandWithImageCleanup,
};

export type ImageCleanupService = typeof imageCleanupService;
