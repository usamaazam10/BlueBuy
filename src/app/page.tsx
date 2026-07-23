import { Hero } from '@/components/sections/hero';
import { FeaturedCategories } from '@/components/sections/featured-categories';
import { FeaturedProducts } from '@/components/sections/featured-products';
import { WhyChooseUs } from '@/components/sections/why-choose-us';
import { CtaBanner } from '@/components/sections/cta-banner';

export default function HomePage() {
  return (
    <>
      <Hero />
      <FeaturedCategories />
      <FeaturedProducts />
      <WhyChooseUs />
      <CtaBanner />
    </>
  );
}
