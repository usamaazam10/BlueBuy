/**
 * SEO helpers for storefront product pages.
 *
 * Produces Next.js `Metadata` (title, description, Open Graph, Twitter card,
 * canonical URL) and a schema.org `Product` JSON-LD object from a mapped
 * `StoreProduct`. Because the app is a static export, these run at build time in
 * `generateMetadata` / the page body, so each product ships real, per-product
 * SEO in its static HTML.
 */
import type { Metadata } from 'next';
import { env } from '@/lib/env';
import { SITE_CONFIG } from '@/constants/site';
import type { StoreProduct } from '@/types/store';

/** Absolute URL for a storefront path, honouring the GitHub Pages base path. */
export function absoluteUrl(path: string): string {
  const base = env.siteUrl.replace(/\/$/, '');
  const prefix = env.basePath.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${prefix}${suffix}`;
}

/** Canonical URL for a product's details page. */
export function productUrl(slug: string): string {
  return absoluteUrl(`/product/${slug}/`);
}

/** Build per-product page metadata (title, description, OG, Twitter, canonical). */
export function buildProductMetadata(product: StoreProduct): Metadata {
  const title = product.seoTitle || product.title;
  const description = product.seoDescription || product.shortDescription || product.description;
  const url = productUrl(product.slug);
  const images = product.thumbnail ? [{ url: product.thumbnail, alt: product.title }] : undefined;

  return {
    title,
    description,
    keywords: product.metaKeywords.length > 0 ? product.metaKeywords : undefined,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: SITE_CONFIG.name,
      title,
      description,
      url,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: product.thumbnail ? [product.thumbnail] : undefined,
    },
  };
}

/**
 * Serialize a JSON-LD object for safe embedding inside a `<script>` tag.
 *
 * `JSON.stringify` does not escape `<`, `>` or `&`, so a product field that
 * happens to contain `</script>` (or an HTML comment / CDATA sequence) could
 * break out of the script element and inject markup. Escaping the significant
 * characters as unicode escapes keeps the JSON valid while making breakout
 * impossible. Use this instead of `JSON.stringify` for any `dangerouslySetInnerHTML`.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/** schema.org `Product` JSON-LD for rich search results. */
export function productJsonLd(product: StoreProduct): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.shortDescription || product.description,
    sku: product.id,
    image: product.images.map((image) => image.url),
    ...(product.brandName ? { brand: { '@type': 'Brand', name: product.brandName } } : {}),
    ...(product.categoryName ? { category: product.categoryName } : {}),
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: product.currency,
      price: product.price,
      availability:
        product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: productUrl(product.slug),
    },
  };
}
