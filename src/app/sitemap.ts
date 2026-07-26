import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { getStoreCatalog } from '@/lib/server/catalog';

// Required for `output: 'export'` — emit a static sitemap.xml at build time.
export const dynamic = 'force-static';

/**
 * Build-time `sitemap.xml` for the storefront.
 *
 * Runs during the static export (`output: 'export'`), so it enumerates the
 * public storefront routes plus one entry per active product read from
 * Firestore. Admin/login/cart/checkout are intentionally excluded — they are
 * private or non-indexable flows. Firestore access is wrapped so an unreachable
 * or unconfigured backend degrades to "static routes only" instead of failing
 * the build (mirrors `generateStaticParams`).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/products/'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/about/'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: absoluteUrl('/contact/'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const products = await getStoreCatalog();
    const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
      url: absoluteUrl(`/product/${product.slug}/`),
      lastModified: product.createdAtMs > 0 ? new Date(product.createdAtMs) : now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
    return [...staticRoutes, ...productRoutes];
  } catch (error) {
    console.warn('[sitemap] could not read Firestore — emitting static routes only:', error);
    return staticRoutes;
  }
}
