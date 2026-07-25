/**
 * Zod schemas for orders and the checkout form.
 *
 * These are the single source of truth for what a valid order looks like.
 * The checkout form validates against {@link checkoutCustomerSchema} before
 * submitting, and {@link createOrderSchema} is re-validated inside the
 * repository so malformed data can never reach Firestore regardless of caller.
 */
import { z } from 'zod';
import { ORDER_STATUSES } from '@/types/order';
import { idSchema, slugSchema, nonEmptyString, priceSchema, currencySchema } from './common';

/** Lenient international phone check: digits, spaces, and + ( ) - separators. */
const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a valid phone number')
  .max(20, 'Phone number is too long')
  .regex(/^[+]?[\d\s()-]{7,20}$/, 'Enter a valid phone number');

/** Order status enum, derived from the canonical list in `@/types/order`. */
export const orderStatusSchema = z.enum(ORDER_STATUSES as [string, ...string[]]);

/**
 * Customer details collected at checkout. Email and notes are optional; empty
 * strings are normalised to `undefined` so optional fields stay absent in
 * Firestore rather than being stored as `""`.
 */
export const checkoutCustomerSchema = z.object({
  fullName: nonEmptyString.max(120, 'Name is too long'),
  phone: phoneSchema,
  email: z
    .union([z.email('Enter a valid email'), z.literal('')])
    .optional()
    .transform((value) => (value ? value : undefined)),
  city: nonEmptyString.max(80, 'City is too long'),
  address: nonEmptyString.max(500, 'Address is too long'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes are too long')
    .optional()
    .transform((value) => (value ? value : undefined)),
});

/** A single purchased line item. */
export const orderItemSchema = z.object({
  productId: idSchema,
  slug: slugSchema,
  title: nonEmptyString,
  image: z.url().optional(),
  accent: z.string(),
  unitPrice: priceSchema,
  quantity: z.number().int().positive().max(999),
  lineTotal: priceSchema,
});

/** Full create-order payload validated inside the repository. */
export const createOrderSchema = z.object({
  customer: checkoutCustomerSchema,
  items: z.array(orderItemSchema).min(1, 'An order needs at least one item'),
  subtotal: priceSchema,
  shipping: priceSchema,
  discount: priceSchema,
  total: priceSchema,
  currency: currencySchema,
});

export type CheckoutCustomerInput = z.infer<typeof checkoutCustomerSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type CreateOrderPayload = z.infer<typeof createOrderSchema>;
