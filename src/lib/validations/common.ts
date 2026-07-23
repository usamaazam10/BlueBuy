/**
 * Shared Zod primitives reused across entity schemas.
 * Keeping these in one place ensures consistent validation rules everywhere.
 */
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';

/** Non-empty Firestore document id. */
export const idSchema = z.string().min(1, 'id is required');

/** URL-safe slug, e.g. "aura-wireless-headphones". */
export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase, hyphen-separated slug');

/** A trimmed, non-empty string. */
export const nonEmptyString = z.string().trim().min(1, 'Required');

/** A monetary amount in major units (>= 0). */
export const priceSchema = z.number().nonnegative().finite();

/** ISO 4217 currency code, e.g. "USD". */
export const currencySchema = z
  .string()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'Must be a 3-letter ISO currency code')
  .default('USD');

/** A rating between 0 and 5. */
export const ratingSchema = z.number().min(0).max(5);

/**
 * A Firestore timestamp field. Accepts a `Timestamp` (at rest), a `Date`
 * (post-conversion), or `null` (pending server timestamp on a fresh write).
 */
export const firestoreDateSchema = z.union([z.instanceof(Timestamp), z.date(), z.null()]);
