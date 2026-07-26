import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/seo';
import { Hero } from '@/components/sections/hero';
import { FeaturedCategories } from '@/components/sections/featured-categories';
import { FeaturedProducts } from '@/components/sections/featured-products';
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
      <Hero />
      <FeaturedCategories />
      <FeaturedProducts />
      <WhyChooseUs />
      <CtaBanner />
    </>
  );
}
