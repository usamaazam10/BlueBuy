/**
 * Static, app-wide configuration values.
 *
 * The canonical site URL is NOT stored here — it is environment-specific and
 * lives in `env.siteUrl` (`@/lib/env`). Use that for any absolute/OG/canonical
 * link so local dev and production resolve correctly.
 */
import { env } from '@/lib/env';

export const SITE_CONFIG = {
  name: 'BlueBuy',
  description:
    'BlueBuy is an online store offering a carefully selected range of products, from trusted brands and our own BlueBuy Collection.',
} as const;

export type SiteConfig = typeof SITE_CONFIG;

/** basePath-aware public asset path (GitHub Pages subpath safe). */
const asset = (path: string) => `${env.basePath}${path}`;

/**
 * Built-in BlueBuy brand assets committed under `public/brand/`. These are the
 * defaults the storefront falls back to when no CMS override is configured in
 * Site Settings — so the real logo shows out of the box, yet a single Site
 * Settings change still overrides it everywhere (nothing is hardcoded in
 * components; branding always flows through `site_settings`). Derived from the
 * provided BlueBuy brand sheet.
 */
export const BRAND_ASSETS = {
  /** Header/footer mark (self-contained blue tile, works on light + dark). */
  mark: asset('/brand/mark.png'),
  favicon: asset('/brand/favicon.png'),
  appleTouchIcon: asset('/brand/apple-touch-icon.png'),
  manifestIcon: asset('/brand/app-icon.png'),
  /** Absolute URL for social cards (Open Graph needs an absolute URL). */
  ogImage: `${env.siteUrl}${asset('/brand/og.png')}`,
} as const;
