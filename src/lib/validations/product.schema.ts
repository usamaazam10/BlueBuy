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

export const productImageSchema = z.object({
  id: idSchema,
  url: z.url(),
  storagePath: z.string().optional(),
  alt: z.string().default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
  isPrimary: z.boolean().default(false),
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
  images: z.array(productImageSchema).default([]),
  thumbnail: z.url().or(z.literal('')).default(''),
  rating: ratingSchema.default(0),
  reviewCount: z.number().int().nonnegative().default(0),
  stock: z.number().int().nonnegative().default(0),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
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

export type ProductImageInput = z.infer<typeof productImageSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductDocument = z.infer<typeof productSchema>;
