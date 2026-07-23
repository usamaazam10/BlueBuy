/** Static, app-wide configuration values. */
export const SITE_CONFIG = {
  name: 'BlueBuy',
  description: 'A modern, production-ready ecommerce experience.',
  url: 'http://localhost:3000',
} as const;

export type SiteConfig = typeof SITE_CONFIG;
