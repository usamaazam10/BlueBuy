/**
 * Centralized, typed access to public environment variables.
 *
 * Only `NEXT_PUBLIC_*` variables are available in the browser. Server-only
 * secrets should be read directly from `process.env` inside server code and
 * must never be imported into a client component.
 *
 * Firebase config is intentionally NOT duplicated here — it is owned by
 * `@/firebase/config`, which reads `process.env` directly and validates the
 * required keys. Keeping a single source avoids drift between the two.
 */
import { normalizeBasePath } from '@/lib/base-path';

export const env = {
  /**
   * Subpath the site is served under. Empty on the custom domain
   * (`https://bluebuy.store/`), `/<repo>` for a GitHub Pages project site.
   * Normalized so it always matches `basePath` in `next.config.ts`.
   */
  basePath: normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH),

  /** Public site URL, useful for absolute metadata/OG links. */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',

  /**
   * Store WhatsApp number in international format, digits only (no `+`), e.g.
   * `15551234567`.
   *
   * Deprecated as the primary source: the number now lives in the CMS
   * (`site_settings.whatsappNumber`, read via `useWhatsApp()`). This remains
   * only as a fallback for settings docs written before that field existed.
   * Empty when unset — never a placeholder, so an unconfigured store hides its
   * WhatsApp UI instead of linking to a number that doesn't exist.
   */
  storeWhatsApp: (process.env.NEXT_PUBLIC_STORE_WHATSAPP ?? '').replace(/\D/g, ''),
} as const;
