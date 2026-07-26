import { absoluteUrl, serializeJsonLd } from '@/lib/seo';
import { SITE_CONFIG } from '@/constants/site';

/**
 * Site-level schema.org structured data (Organization + WebSite), emitted in the
 * homepage's static HTML for rich search results and brand knowledge panels.
 *
 * This is a server component so the JSON-LD ships in the baked `<head>`/body at
 * build time (static export) rather than being injected after hydration. Uses
 * the shared XSS-safe {@link serializeJsonLd}. Per-product `Product` JSON-LD is
 * emitted separately on each product page (see @/lib/seo).
 */
export function OrganizationJsonLd() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_CONFIG.name,
    url: absoluteUrl('/'),
    description: SITE_CONFIG.description,
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_CONFIG.name,
    url: absoluteUrl('/'),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(website) }}
      />
    </>
  );
}
