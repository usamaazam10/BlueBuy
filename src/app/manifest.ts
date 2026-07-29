import type { MetadataRoute } from 'next';
import { SITE_CONFIG, BRAND_ASSETS } from '@/constants/site';
import { env } from '@/lib/env';

// Required for `output: 'export'` — emit a static manifest.webmanifest at build
// time. Next.js injects the matching <link rel="manifest"> into every page.
export const dynamic = 'force-static';

/**
 * Web app manifest, generated at build time (static export).
 *
 * `start_url`/`scope` honour the deploy base path so the manifest is valid both
 * at the custom-domain root (`/`) and under a GitHub Pages project subpath.
 * Icons come from `BRAND_ASSETS`, which is already base-path aware.
 */
export default function manifest(): MetadataRoute.Manifest {
  const scope = `${env.basePath}/`;

  return {
    name: SITE_CONFIG.name,
    short_name: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    start_url: scope,
    scope,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b1120',
    icons: [
      {
        src: BRAND_ASSETS.manifestIcon,
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: BRAND_ASSETS.appleTouchIcon,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
