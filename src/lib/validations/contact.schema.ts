/**
 * Contact-form validation.
 *
 * Lives beside the other schemas so the storefront form and any future
 * server-side consumer validate the same shape. The form is validated in the
 * browser before anything is sent — there is no server to fall back on.
 */
import { z } from 'zod';

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  email: z.email('Please enter a valid email address'),
  subject: z.string().trim().min(3, 'Please add a short subject').max(160),
  message: z.string().trim().min(10, 'Please tell us a little more').max(2000),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;
