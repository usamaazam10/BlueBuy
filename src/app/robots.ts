import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

// Required for `output: 'export'` — emit a static robots.txt at build time.
export const dynamic = 'force-static';

/**
 * `robots.txt`, generated at build time (static export).
 *
 * Allows crawling of the public storefront but disallows the private admin and
 * auth flows, and points crawlers at the sitemap. URLs honour the GitHub Pages
 * base path via `absoluteUrl`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/login/', '/cart/', '/checkout/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
