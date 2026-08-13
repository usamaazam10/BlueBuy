import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { Hero } from '@/components/sections/hero';
import { FeaturedCategories } from '@/components/sections/featured-categories';
import { FeaturedProducts } from '@/components/sections/featured-products';
import { CollectionShowcase } from '@/components/sections/collection-showcase';
import { FeaturedBrands } from '@/components/sections/featured-brands';
import { WhyChooseUs } from '@/components/sections/why-choose-us';
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
      {/* Shopping first: categories and real products lead, reassurance follows. */}
      <Hero />
      <FeaturedCategories />
      <FeaturedProducts />
      <CollectionShowcase />
      <FeaturedBrands />
      <WhyChooseUs />
      <CtaBanner />
    </>
  );
}
