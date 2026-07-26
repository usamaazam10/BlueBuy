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
 * Pre-render every active product page at build time (static export).
 *
 * Reads slugs from Firestore at build. Wrapped in try/catch so an unreachable
 * or unconfigured Firestore degrades to "no product pages" instead of failing
 * the whole build; when that happens the storefront still builds and product
 * links simply 404 until the next successful build.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const products = await ProductRepository.listActive();
    return products.map((product) => ({ slug: product.slug }));
  } catch (error) {
    console.warn('[product] generateStaticParams: could not read Firestore —', error);
    return [];
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
