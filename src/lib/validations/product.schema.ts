/**
 * Zod schemas for the `products` collection.
 * Mirrors the `Product`/`ProductImage` interfaces in `@/types/models`.
 */
import { z } from 'zod';
import {
  idSchema,
  slugSchema,
  nonEmptyString,
  priceSchema,
  currencySchema,
  ratingSchema,
  firestoreDateSchema,
} from './common';

/** A Cloudinary-backed product image (mirrors `ProductImage` in `@/types/models`). */
export const productImageSchema = z.object({
  id: idSchema,
  url: z.url(),
  publicId: nonEmptyString,
  alt: z.string().default(''),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: nonEmptyString,
  bytes: z.number().int().nonnegative(),
  sortOrder: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
});

/** A single label/value specification row. */
export const productSpecificationSchema = z.object({
  label: nonEmptyString,
  value: nonEmptyString,
});

/** Base product fields (no id/timestamps, no cross-field refinement). */
const productBaseSchema = z.object({
  slug: slugSchema,
  title: nonEmptyString.max(160),
  description: nonEmptyString.max(5000),
  shortDescription: nonEmptyString.max(280),
  price: priceSchema,
  salePrice: priceSchema.nullable().default(null),
  currency: currencySchema,
  categoryId: idSchema,
  brandId: idSchema,
  gallery: z.array(productImageSchema).default([]),
  thumbnail: z.url().or(z.literal('')).default(''),
  rating: ratingSchema.default(0),
  reviewCount: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  specifications: z.array(productSpecificationSchema).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  seoTitle: z.string().max(160).default(''),
  seoDescription: z.string().max(320).default(''),
  metaKeywords: z.array(z.string()).default([]),
});

/** salePrice, when present, must not exceed price. */
const saleNotAbovePrice = (data: { price: number; salePrice: number | null }) =>
  data.salePrice === null || data.salePrice <= data.price;
const saleError = {
  message: 'salePrice must be less than or equal to price',
  path: ['salePrice'] as (string | number)[],
};

/** Fields a client provides when creating a product. */
export const productCreateSchema = productBaseSchema.refine(saleNotAbovePrice, saleError);

/** A partial update payload. */
export const productUpdateSchema = productBaseSchema.partial();

/** Full stored document, including server-managed fields. */
export const productSchema = productBaseSchema
  .extend({
    id: idSchema,
    createdAt: firestoreDateSchema,
    updatedAt: firestoreDateSchema,
  })
  .refine(saleNotAbovePrice, saleError);

export type ProductImageInput = z.input<typeof productImageSchema>;
export type ProductSpecificationInput = z.infer<typeof productSpecificationSchema>;
// `z.input` (pre-defaults) so payload builders may omit fields the schema fills
// in — e.g. `currency`, `rating`, `reviewCount` — rather than being forced to
// supply (and, on update, clobber) server-managed values.
export type ProductCreateInput = z.input<typeof productCreateSchema>;
export type ProductUpdateInput = z.input<typeof productUpdateSchema>;
export type ProductDocument = z.infer<typeof productSchema>;
