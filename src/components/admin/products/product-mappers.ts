/**
 * Mapping between the editor's form state and the Firestore `Product` model.
 *
 * This is deliberately the *only* translation layer between the admin UI and
 * the persisted shape. The form speaks strings and slugs; Firestore speaks
 * numbers, ids, and Cloudinary metadata. Keeping the conversion here means the
 * form component stays declarative and the repository stays UI-agnostic.
 */
import { ADMIN_CATEGORIES } from '@/data/admin/categories';
import type { Product } from '@/types/models';
import type { ProductCreateInput, ProductImageInput } from '@/lib/validations';
import type { GalleryImage } from '@/components/admin/ui/image-uploader';
import type { ProductFormValues, ProductSpecRow } from './product-form.types';

/** Resolve a category *slug* to its Firestore category id. */
export function resolveCategoryId(slug: string): string {
  return ADMIN_CATEGORIES.find((category) => category.slug === slug)?.id ?? slug;
}

/** Resolve a category id back to its slug (for loading into the form). */
function categoryIdToSlug(id: string): string {
  return ADMIN_CATEGORIES.find((category) => category.id === id)?.slug ?? id;
}

/** Parse a comma/newline-separated keyword string into a clean array. */
function parseKeywords(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

/** Coerce a numeric input string to a number, or a fallback when blank/invalid. */
function toNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Convert the gallery (only its already-uploaded images) into persistable
 * `ProductImage` records. Order defines `sortOrder`; the first image is primary.
 */
export function galleryToProductImages(images: GalleryImage[]): ProductImageInput[] {
  return images
    .filter((image) => image.uploaded)
    .map((image, index) => ({
      id: image.id,
      url: image.uploaded!.secure_url,
      publicId: image.uploaded!.public_id,
      alt: image.alt,
      width: image.uploaded!.width,
      height: image.uploaded!.height,
      format: image.uploaded!.format,
      bytes: image.uploaded!.bytes,
      sortOrder: index,
      isPrimary: index === 0,
    }));
}

/** Keep only fully-filled specification rows. */
function specsToSpecifications(specs: ProductSpecRow[]) {
  return specs
    .map((spec) => ({ label: spec.label.trim(), value: spec.value.trim() }))
    .filter((spec) => spec.label !== '' && spec.value !== '');
}

/**
 * Build the Firestore write payload from the form values and the resolved
 * gallery images. Used for both create and (as a partial) update; it never
 * includes server-managed fields (`rating`, `reviewCount`, timestamps), so an
 * update can't overwrite them.
 */
export function formToProductInput(
  values: ProductFormValues,
  gallery: ProductImageInput[]
): ProductCreateInput {
  const salePriceRaw = values.salePrice.trim();
  return {
    slug: values.slug.trim(),
    title: values.title.trim(),
    description: values.description.trim(),
    shortDescription: values.shortDescription.trim(),
    price: toNumber(values.price),
    salePrice: salePriceRaw === '' ? null : toNumber(salePriceRaw),
    categoryId: resolveCategoryId(values.categorySlug),
    brandId: values.brandId,
    gallery,
    thumbnail: gallery[0]?.url ?? '',
    stock: Math.trunc(toNumber(values.stock)),
    tags: values.tags,
    specifications: specsToSpecifications(values.specs),
    featured: values.featured,
    active: values.active,
    seoTitle: values.seoTitle.trim(),
    seoDescription: values.seoDescription.trim(),
    metaKeywords: parseKeywords(values.metaKeywords),
  };
}

/** Rebuild an editable gallery item from a stored (already-uploaded) image. */
function productImageToGallery(image: Product['gallery'][number]): GalleryImage {
  return {
    id: image.id,
    previewUrl: image.url,
    uploaded: {
      secure_url: image.url,
      public_id: image.publicId,
      width: image.width,
      height: image.height,
      format: image.format,
      bytes: image.bytes,
    },
    status: 'uploaded',
    progress: 100,
    alt: image.alt,
  };
}

/** Convert a stored `Product` into editable form values (for the edit page). */
export function productToFormValues(product: Product): ProductFormValues {
  const specs =
    product.specifications.length > 0
      ? product.specifications.map((spec, index) => ({
          id: `spec-${index}`,
          label: spec.label,
          value: spec.value,
        }))
      : [{ id: 'spec-0', label: '', value: '' }];

  return {
    title: product.title,
    slug: product.slug,
    shortDescription: product.shortDescription,
    description: product.description,
    price: String(product.price),
    salePrice: product.salePrice != null ? String(product.salePrice) : '',
    stock: String(product.stock),
    categorySlug: categoryIdToSlug(product.categoryId),
    brandId: product.brandId,
    featured: product.featured,
    active: product.active,
    tags: product.tags,
    specs,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    metaKeywords: product.metaKeywords.join(', '),
    images: product.gallery.map(productImageToGallery),
  };
}

/** Field-level errors keyed by form field name. */
export type ProductFormErrors = Partial<
  Record<'title' | 'slug' | 'price' | 'salePrice' | 'categorySlug' | 'brandId', string>
>;

/**
 * Client-side validation for immediate, per-field feedback. The repository +
 * Zod schema remain the authoritative gate; this just fails fast in the UI.
 */
export function validateProductForm(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};

  if (values.title.trim() === '') errors.title = 'Title is required.';

  if (values.slug.trim() === '') {
    errors.slug = 'Slug is required.';
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
    errors.slug = 'Use lowercase letters, numbers and hyphens only.';
  }

  const price = Number(values.price);
  if (values.price.trim() === '' || !Number.isFinite(price)) {
    errors.price = 'Enter a price.';
  } else if (price < 0) {
    errors.price = 'Price cannot be negative.';
  }

  const saleRaw = values.salePrice.trim();
  if (saleRaw !== '') {
    const sale = Number(saleRaw);
    if (!Number.isFinite(sale) || sale < 0) {
      errors.salePrice = 'Sale price cannot be negative.';
    } else if (Number.isFinite(price) && sale > price) {
      errors.salePrice = 'Sale price must be at or below the price.';
    }
  }

  if (!values.categorySlug) errors.categorySlug = 'Choose a category.';
  if (!values.brandId) errors.brandId = 'Choose a brand.';

  return errors;
}
