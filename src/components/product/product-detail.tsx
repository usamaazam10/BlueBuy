'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import type { StoreProduct } from '@/types/store';
import { useStoreProducts } from '@/hooks/queries';
import { useCurrency } from '@/hooks/use-currency';
import { optimizeImageUrl } from '@/services/cloudinary';
import { Container } from '@/components/layout/container';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/product/rating';
import { ProductGallery } from '@/components/product/product-gallery';
import { ProductPurchase } from '@/components/product/product-purchase';
import { ProductGrid } from '@/components/product/product-grid';
import { SectionTitle } from '@/components/common/section-title';
import { TrustSignals } from '@/components/common/trust-signals';
import { BLUEBUY_COLLECTION, isCollectionProduct } from '@/lib/collection';
import { track } from '@/lib/analytics/tracker';

const BADGE_VARIANT = {
  Sale: 'sale',
  New: 'new',
  Featured: 'featured',
  Limited: 'limited',
} as const;

interface ProductDetailProps {
  slug: string;
  /** Server-rendered (build-time) data — the instant, SEO-visible fallback. */
  initialProduct: StoreProduct;
  initialRelated: StoreProduct[];
}

/**
 * Client detail view. Renders from the build-time `initial*` props for instant,
 * crawlable content, then transparently swaps to live React Query data once the
 * catalogue loads (so price/stock stay fresh without a rebuild).
 */
export function ProductDetail({ slug, initialProduct, initialRelated }: ProductDetailProps) {
  const { data } = useStoreProducts();
  const { formatPrice } = useCurrency();

  const product = React.useMemo(
    () => data.find((p) => p.slug === slug) ?? initialProduct,
    [data, slug, initialProduct]
  );

  const related = React.useMemo(() => {
    if (data.length === 0) return initialRelated;
    const sameCategory = data.filter(
      (p) => p.categorySlug === product.categorySlug && p.id !== product.id
    );
    const others = data.filter(
      (p) => p.categorySlug !== product.categorySlug && p.id !== product.id
    );
    return [...sameCategory, ...others].slice(0, 4);
  }, [data, product, initialRelated]);

  // Records one product view per product per mount. Keyed on the id so
  // navigating between products tracks each, while a re-render does not.
  const viewedId = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!product?.id || viewedId.current === product.id) return;
    viewedId.current = product.id;
    track('product_view', {
      productId: product.id,
      productTitle: product.title,
      categoryId: product.categoryId,
      brandId: product.brandId,
      value: product.price,
    });
  }, [product?.id, product?.title, product?.categoryId, product?.brandId, product?.price]);

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
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/products?category=${product.categorySlug}`}
                  className="text-brand text-sm font-semibold tracking-wide uppercase"
                >
                  {product.categoryName}
                </Link>
                {!isCollectionProduct(product) ? (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                    <span aria-hidden>·</span>
                    {product.brandLogo && (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export
                      <img
                        src={
                          product.brandLogoPublicId
                            ? optimizeImageUrl(product.brandLogoPublicId, { height: 40 })
                            : product.brandLogo
                        }
                        alt={product.brandName}
                        className="h-4 w-auto max-w-16 object-contain"
                        loading="lazy"
                      />
                    )}
                    {product.brandName}
                  </span>
                ) : (
                  // No brand, or BlueBuy's own label → presented as one line:
                  // the BlueBuy Collection.
                  <Link
                    href={`/products?brand=${BLUEBUY_COLLECTION.slug}`}
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
                  >
                    <span aria-hidden>·</span>
                    {BLUEBUY_COLLECTION.name}
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
            {product.highlights.length > 0 && (
              <ul className="flex flex-col gap-2 pt-2">
                {product.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-2.5 text-sm">
                    <Check className="text-brand size-4 shrink-0" />
                    {highlight}
                  </li>
                ))}
              </ul>
            )}

            {/* Reassurance — canonical claims, shared with the cart & checkout */}
            <TrustSignals
              items={['curated', 'collection', 'support', 'noPayment']}
              className="mt-2"
            />
          </div>
        </div>

        {/* Specifications */}
        {product.specs.length > 0 && (
          <section className="mt-16 max-w-3xl" aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="text-xl font-semibold">
              Specifications
            </h2>
            <dl className="divide-border border-border mt-4 divide-y rounded-2xl border">
              {product.specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <dt className="text-muted-foreground text-sm">{spec.label}</dt>
                  <dd className="text-sm font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
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
