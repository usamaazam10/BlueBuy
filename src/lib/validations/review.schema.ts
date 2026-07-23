/**
 * Zod schemas for the `reviews` collection.
 * Mirrors the `Review` interface in `@/types/models`.
 */
import { z } from 'zod';
import { idSchema, nonEmptyString, firestoreDateSchema } from './common';

const reviewBaseSchema = z.object({
  /** Reference → products.id */
  productId: idSchema,
  /** Reference → auth user uid */
  userId: idSchema,
  authorName: nonEmptyString.max(120),
  /** Whole-star rating 1–5. */
  rating: z.number().int().min(1).max(5),
  title: z.string().max(160).default(''),
  body: nonEmptyString.max(5000),
  verifiedPurchase: z.boolean().default(false),
  helpfulCount: z.number().int().nonnegative().default(0),
});

export const reviewCreateSchema = reviewBaseSchema;
export const reviewUpdateSchema = reviewBaseSchema.partial();
export const reviewSchema = reviewBaseSchema.extend({
  id: idSchema,
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
export type ReviewUpdateInput = z.infer<typeof reviewUpdateSchema>;
export type ReviewDocument = z.infer<typeof reviewSchema>;
