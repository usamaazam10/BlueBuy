/**
 * Zod schema for cart line items.
 * Mirrors the `CartItem` interface in `@/types/models`.
 */
import { z } from 'zod';
import {
  idSchema,
  slugSchema,
  nonEmptyString,
  priceSchema,
  currencySchema,
  firestoreDateSchema,
} from './common';

export const cartItemSchema = z.object({
  /** Reference → products.id */
  productId: idSchema,
  slug: slugSchema,
  title: nonEmptyString,
  thumbnail: z.url().or(z.literal('')).default(''),
  /** Price snapshotted at add-time. */
  unitPrice: priceSchema,
  currency: currencySchema,
  quantity: z.number().int().positive().max(999),
  addedAt: firestoreDateSchema,
});

/** Payload to add an item to a cart (server stamps `addedAt`). */
export const cartItemAddSchema = cartItemSchema.omit({ addedAt: true });

export type CartItemInput = z.infer<typeof cartItemSchema>;
export type CartItemAddInput = z.infer<typeof cartItemAddSchema>;
