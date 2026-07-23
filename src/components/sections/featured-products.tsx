import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getFeaturedProducts } from '@/data/products';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { ProductGrid } from '@/components/product/product-grid';
import { Button } from '@/components/ui/button';

export function FeaturedProducts() {
  const products = getFeaturedProducts(8);

  return (
    <section className="bg-secondary/30 py-20 sm:py-24">
      <Container>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            align="left"
            eyebrow="Featured"
            title="Best of BlueBuy"
            description="Hand-picked favourites our customers love most."
            className="items-center text-center sm:items-start sm:text-left"
          />
          <Button asChild variant="outline" className="hidden shrink-0 sm:inline-flex">
            <Link href="/products">
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        <ProductGrid products={products} className="mt-12" />

        <div className="mt-10 flex justify-center sm:hidden">
          <Button asChild variant="outline">
            <Link href="/products">
              View all products <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
