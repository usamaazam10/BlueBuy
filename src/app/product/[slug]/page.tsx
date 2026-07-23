import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Check, ChevronRight, Truck, ShieldCheck } from 'lucide-react';
import { PRODUCTS, getProductBySlug, getRelatedProducts } from '@/data/products';
import { getCategoryBySlug } from '@/data/categories';
import { formatPrice } from '@/lib/format';
import { Container } from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/product/rating';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductPurchase } from '@/components/product/product-purchase';
import { ProductGrid } from '@/components/product/product-grid';
import { SectionTitle } from '@/components/common/section-title';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// Pre-render every product page at build time for static export.
export function generateStaticParams() {
  return PRODUCTS.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: 'Product not found' };
  return {
    title: product.title,
    description: product.description,
  };
}

const BADGE_VARIANT = {
  Sale: 'sale',
  New: 'new',
  Bestseller: 'bestseller',
  Limited: 'limited',
} as const;

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const category = getCategoryBySlug(product.category);
  const related = getRelatedProducts(product);
  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  return (
    <>
      <Container className="py-8 sm:py-12">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground mb-8 flex items-center gap-1.5 text-sm"
        >
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/products" className="hover:text-foreground transition-colors">
            Products
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="text-foreground truncate">{product.title}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery product={product} />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {category && (
                  <Link
                    href={`/products?category=${category.slug}`}
                    className="text-brand text-sm font-semibold tracking-wide uppercase"
                  >
                    {category.name}
                  </Link>
                )}
                {product.badge && (
                  <Badge variant={BADGE_VARIANT[product.badge]}>{product.badge}</Badge>
                )}
              </div>
              <h1 className="text-3xl font-semibold sm:text-4xl">{product.title}</h1>
              <Rating value={product.rating} reviewCount={product.reviewCount} size="md" />
            </div>

            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{formatPrice(product.price)}</span>
              {product.compareAtPrice && (
                <>
                  <span className="text-muted-foreground text-lg line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                  <Badge variant="sale">
                    Save {formatPrice(product.compareAtPrice - product.price)}
                  </Badge>
                </>
              )}
            </div>

            <p className="text-muted-foreground text-pretty">{product.description}</p>

            {/* Stock status */}
            <p className="flex items-center gap-2 text-sm">
              {outOfStock ? (
                <span className="text-muted-foreground">Currently out of stock</span>
              ) : (
                <span className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-2 rounded-full bg-current" />
                  {lowStock ? `Only ${product.stock} left in stock` : 'In stock'}
                </span>
              )}
            </p>

            <ProductPurchase product={product} />

            {/* Highlights */}
            <ul className="flex flex-col gap-2 pt-2">
              {product.highlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-2.5 text-sm">
                  <Check className="text-brand size-4 shrink-0" />
                  {highlight}
                </li>
              ))}
            </ul>

            {/* Reassurance */}
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="border-border flex items-center gap-2.5 rounded-xl border p-3 text-sm">
                <Truck className="text-muted-foreground size-5 shrink-0" />
                Free 2-day shipping
              </div>
              <div className="border-border flex items-center gap-2.5 rounded-xl border p-3 text-sm">
                <ShieldCheck className="text-muted-foreground size-5 shrink-0" />
                2-year warranty
              </div>
            </div>
          </div>
        </div>

        {/* Specifications */}
        <section className="mt-16 max-w-3xl" aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="text-xl font-semibold">
            Specifications
          </h2>
          <dl className="divide-border border-border mt-4 divide-y rounded-2xl border">
            {product.specs.map((spec) => (
              <div key={spec.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <dt className="text-muted-foreground text-sm">{spec.label}</dt>
                <dd className="text-sm font-medium">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Container>

      {/* Related products */}
      {related.length > 0 && (
        <section className="bg-secondary/30 mt-20 py-20">
          <Container>
            <SectionTitle align="left" eyebrow="You may also like" title="Related products" />
            <ProductGrid products={related} className="mt-10" />
          </Container>
        </section>
      )}
    </>
  );
}
