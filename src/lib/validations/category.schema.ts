/**
 * Zod schemas for the `categories` collection.
 * Mirrors the `Category` interface in `@/types/models`.
 */
import { z } from 'zod';
import { idSchema, slugSchema, nonEmptyString, firestoreDateSchema } from './common';

const categoryBaseSchema = z.object({
  slug: slugSchema,
  name: nonEmptyString.max(120),
  description: z.string().max(1000).default(''),
  image: z.url().nullable().default(null),
  /** Reference → categories.id for nesting; null for top-level. */
  parentId: idSchema.nullable().default(null),
  productCount: z.number().int().nonnegative().default(0),
  sortOrder: z.number().int().nonnegative().default(0),
  active: z.boolean().default(true),
});

export const categoryCreateSchema = categoryBaseSchema;
export const categoryUpdateSchema = categoryBaseSchema.partial();
export const categorySchema = categoryBaseSchema.extend({
  id: idSchema,
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryDocument = z.infer<typeof categorySchema>;
