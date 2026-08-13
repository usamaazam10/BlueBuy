'use client';

import * as React from 'react';
import Link from 'next/link';
import { useStoreBrands, useStoreProducts } from '@/hooks/queries';
import { optimizeImageUrl } from '@/services/cloudinary';
import { countBy } from '@/lib/product-counts';
import { isOwnLabelBrand } from '@/lib/collection';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { Stagger, StaggerItem } from '@/components/common/motion';

/**
 * "Shop by brand" — the third-party brands in the catalogue, each linking to the
 * products page pre-filtered to that brand.
 *
 * Two things are filtered out. Brands with no live product, because a logo wall
 * padded with brands the store carries nothing from implies a range that isn't
 * there. And BlueBuy's own label, because that isn't a third-party brand — it is
 * the BlueBuy Collection, which has its own band on this page. When nothing
 * qualifies (a catalogue that is entirely own-label), the section disappears.
 */
export function FeaturedBrands() {
  const { data: brands, isLoading } = useStoreBrands();
  const { data: products } = useStoreProducts();

  const countByBrand = React.useMemo(() => countBy(products, 'brandId'), [products]);

  const stocked = React.useMemo(
    () =>
      brands.filter(
        (brand) => !isOwnLabelBrand(brand.name) && (countByBrand.get(brand.id) ?? 0) > 0
      ),
    [brands, countByBrand]
  );

  if (isLoading || stocked.length === 0) return null;

  return (
    // `id` anchors the footer's "Brands" link.
    <section id="brands" className="bg-secondary/30 scroll-mt-24 py-20 sm:py-24">
      <Container>
        <SectionTitle
          eyebrow="Brands"
          title="Shop by brand"
          description="Browse the brands stocked in our catalogue."
        />

        <Stagger className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stocked.map((brand) => {
            const count = countByBrand.get(brand.id) ?? 0;
            return (
              <StaggerItem key={brand.id}>
                <Link
                  href={`/products?brand=${brand.slug}`}
                  className="group bg-card border-border hover:border-foreground/15 hover:shadow-foreground/5 focus-visible:ring-ring flex h-full flex-col items-center justify-center gap-3 rounded-2xl border p-6 transition-all hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
                >
                  {brand.logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary src under static export */
                    <img
                      src={
                        brand.logoPublicId
                          ? optimizeImageUrl(brand.logoPublicId, { height: 96 })
                          : brand.logo
                      }
                      alt={brand.name}
                      loading="lazy"
                      className="h-8 w-auto max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-base font-semibold">{brand.name}</span>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {count} {count === 1 ? 'product' : 'products'}
                  </span>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </Container>
    </section>
  );
}
