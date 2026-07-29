/**
 * Zod schemas for the `orphaned_assets` collection.
 * Mirrors the `OrphanedAsset` interface in `@/types/models`.
 *
 * An orphaned asset is a Cloudinary `public_id` whose owning document was
 * deleted (or whose image was replaced). It is recorded here so an operator can
 * reconcile Cloudinary from the admin — see the model doc for the full rationale.
 */
import { z } from 'zod';
import { idSchema, nonEmptyString, firestoreDateSchema } from './common';

export const orphanedAssetSourceTypes = ['product', 'category', 'brand'] as const;

/** Payload recorded when a document's asset is orphaned. */
export const orphanedAssetCreateSchema = z.object({
  publicId: nonEmptyString.max(500),
  url: z.string().trim().max(2048).default(''),
  sourceType: z.enum(orphanedAssetSourceTypes),
  sourceId: z.string().trim().max(200).default(''),
  sourceLabel: z.string().trim().max(300).default(''),
  cleaned: z.boolean().default(false),
});

export const orphanedAssetSchema = orphanedAssetCreateSchema.extend({
  id: idSchema,
  cleaned: z.boolean(),
  cleanedAt: firestoreDateSchema,
  createdAt: firestoreDateSchema,
  updatedAt: firestoreDateSchema,
});

export type OrphanedAssetCreateInput = z.infer<typeof orphanedAssetCreateSchema>;
export type OrphanedAssetDocument = z.infer<typeof orphanedAssetSchema>;
