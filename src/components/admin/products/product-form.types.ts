/**
 * Shared shapes for the product editor form.
 *
 * Kept separate from the form component so the form, the Firestore mappers, and
 * the edit-page loader can all import them without circular dependencies.
 */
import type { GalleryImage } from '@/components/admin/ui/image-uploader';

/** One row in the specifications editor. */
export interface ProductSpecRow {
  id: string;
  label: string;
  value: string;
}

/**
 * The editor's local form state. String fields for numeric inputs (price,
 * stock, …) mirror the raw `<input>` values and are coerced on submit.
 */
export interface ProductFormValues {
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: string;
  salePrice: string;
  stock: string;
  /** Firestore category id (references the `categories` collection). */
  categoryId: string;
  brandId: string;
  featured: boolean;
  active: boolean;
  tags: string[];
  specs: ProductSpecRow[];
  seoTitle: string;
  seoDescription: string;
  /** Comma-separated in the input; split into an array on save. */
  metaKeywords: string;
  images: GalleryImage[];
}

/** A blank form, used by the "New product" page. */
export const EMPTY_PRODUCT: ProductFormValues = {
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  price: '',
  salePrice: '',
  stock: '',
  categoryId: '',
  brandId: '',
  featured: false,
  active: true,
  tags: [],
  specs: [{ id: 'spec-0', label: '', value: '' }],
  seoTitle: '',
  seoDescription: '',
  metaKeywords: '',
  images: [],
};
