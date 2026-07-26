/**
 * Static, app-wide configuration values.
 *
 * The canonical site URL is NOT stored here — it is environment-specific and
 * lives in `env.siteUrl` (`@/lib/env`). Use that for any absolute/OG/canonical
 * link so local dev and production resolve correctly.
 */
export const SITE_CONFIG = {
  name: 'BlueBuy',
  description: 'A modern, production-ready ecommerce experience.',
} as const;

export type SiteConfig = typeof SITE_CONFIG;
