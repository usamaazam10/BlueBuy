import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ProductRepository } from '@/repositories';
import { getStoreProductBySlug, getRelatedStoreProducts } from '@/lib/server/catalog';
import { buildProductMetadata, productJsonLd, serializeJsonLd } from '@/lib/seo';
import { ProductDetail } from '@/components/product/product-detail';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Any unknown slug (not produced by generateStaticParams) resolves to the 404
 * page. There is no server at runtime, so this is the only correct behaviour
 * for a static export — it also makes the intent explicit.
 */
export const dynamicParams = false;

/**
 * A single unreachable sentinel slug. `output: export` refuses a dynamic route
 * that yields ZERO static params, so when the catalog is empty or Firestore is
 * unreachable at build time we must still emit at least one param or the whole
 * deploy fails. This slug can never match a real product (it renders the 404),
 * so it is invisible in production and only ever emitted in the degraded case.
 */
const NO_PRODUCTS_SENTINEL = '__no-products__';

/**
 * Pre-render every active product page at build time (static export).
 *
 * Reads slugs from Firestore at build. Wrapped in try/catch so an unreachable
 * or unconfigured Firestore degrades to "no product pages" instead of failing
 * the whole build; when that happens the storefront still builds and product
 * links simply 404 until the next successful build. Because `output: export`
 * rejects an empty param set, an empty/unreachable catalog falls back to a
 * single unreachable sentinel so the build stays green either way.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const products = await ProductRepository.listActive();
    const params = products.map((product) => ({ slug: product.slug }));
    return params.length > 0 ? params : [{ slug: NO_PRODUCTS_SENTINEL }];
  } catch (error) {
    console.warn('[product] generateStaticParams: could not read Firestore —', error);
    return [{ slug: NO_PRODUCTS_SENTINEL }];
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getStoreProductBySlug(slug);
    if (!product) return { title: 'Product not found' };
    return buildProductMetadata(product);
  } catch {
    return { title: 'Product' };
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getStoreProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedStoreProducts(product);
  const jsonLd = productJsonLd(product);

  return (
    <>
      {/* schema.org Product JSON-LD, emitted in the static HTML for SEO. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ProductDetail slug={slug} initialProduct={product} initialRelated={related} />
    </>
  );
}
