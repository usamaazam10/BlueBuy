import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { Hero } from '@/components/sections/hero';
import { FeaturedCategories } from '@/components/sections/featured-categories';
import { FeaturedProducts } from '@/components/sections/featured-products';
import { CollectionShowcase } from '@/components/sections/collection-showcase';
import { FeaturedBrands } from '@/components/sections/featured-brands';
import { TrustStrip } from '@/components/sections/trust-strip';
import { DealsShelf } from '@/components/sections/deals-shelf';
import { CategoryShelves } from '@/components/sections/category-shelves';
import { CtaBanner } from '@/components/sections/cta-banner';
import { HomepageSeo } from '@/components/sections/homepage-seo';
import { OrganizationJsonLd } from '@/components/sections/organization-jsonld';

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl('/') },
};

export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <HomepageSeo />
      {/* Marketplace flow: photo slideshow + deals up top, then categories and
          product shelves, with brand story and reassurance further down. */}
      <Hero />
      <TrustStrip />
      <FeaturedCategories />
      <DealsShelf />
      <FeaturedProducts />
      <CategoryShelves />
      <CollectionShowcase />
      <FeaturedBrands />
      <CtaBanner />
    </>
  );
}
