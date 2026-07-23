/**
 * Zod schema + types for the admin login form. Kept separate from the UI so the
 * same validation contract can be reused (e.g. in tests) without importing React.
 */
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required.')
    .pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** Field-keyed error messages produced from a failed `safeParse`. */
export type LoginErrors = Partial<Record<keyof LoginValues, string>>;
