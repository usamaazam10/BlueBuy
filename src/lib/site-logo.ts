/**
 * Resolves the effective branding assets from `site_settings`, applying the
 * built-in BlueBuy defaults ({@link BRAND_ASSETS}) wherever a field is unset.
 *
 * This is the single place branding fallbacks live, so a Site Settings change
 * propagates everywhere (header, footer, favicon, social cards, PWA icon) and
 * nothing is hardcoded in individual components. `headerLogo`/`footerLogo` stay
 * empty when unset so the caller can fall back to the built-in wordmark lockup;
 * icon/social assets always resolve to a concrete URL.
 */
import { BRAND_ASSETS } from '@/constants/site';
import type { SiteSettings } from '@/types/cms';

export interface ResolvedLogos {
  /** Header logo image URL, or '' to render the wordmark lockup. */
  headerLogo: string;
  /** Footer logo image URL, or '' to render the wordmark lockup. */
  footerLogo: string;
  favicon: string;
  appleTouchIcon: string;
  ogImage: string;
  manifestIcon: string;
  /** Email logo (future transactional emails). */
  emailLogo: string;
}

export function resolveLogos(settings?: Partial<SiteSettings> | null): ResolvedLogos {
  const logo = settings?.logoUrl || '';
  return {
    headerLogo: settings?.headerLogoUrl || logo,
    footerLogo: settings?.footerLogoUrl || logo,
    favicon: settings?.faviconUrl || BRAND_ASSETS.favicon,
    appleTouchIcon: settings?.appleTouchIconUrl || BRAND_ASSETS.appleTouchIcon,
    ogImage: settings?.ogImageUrl || BRAND_ASSETS.ogImage,
    manifestIcon: settings?.manifestIconUrl || BRAND_ASSETS.manifestIcon,
    emailLogo: settings?.emailLogoUrl || logo || BRAND_ASSETS.mark,
  };
}
