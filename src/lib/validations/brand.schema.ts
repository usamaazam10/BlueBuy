/**
 * Zod schemas for the `brands` collection.
 * Mirrors the `Brand` interface in `@/types/models`.
 */
import { z } from 'zod';
import { idSchema, slugSchema, nonEmptyString, firestoreDateSchema } from './common';

const brandBaseSchema = z.object({
  slug: slugSchema,
  name: nonEmptyString.max(120),
  description: z.string().max(1000).default(''),
  logo: z.url().nullable().default(null),
  website: z.url().nullable().default(null),
  active: z.boolean().default(true),
});

export const brandCreateSchema = brandBaseSchema;
export const brandUpdateSchema = brandBaseSchema.partial();
export const brandSchema = brandBaseSchema.extend({
  id: idSchema,
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
});

export type BrandCreateInput = z.infer<typeof brandCreateSchema>;
export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;
export type BrandDocument = z.infer<typeof brandSchema>;
