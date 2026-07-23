import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { CATEGORIES } from '@/data/categories';
import { Container } from '@/components/layout/container';
import { SectionTitle } from '@/components/common/section-title';
import { Stagger, StaggerItem } from '@/components/common/motion';

export function FeaturedCategories() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionTitle
          eyebrow="Browse"
          title="Shop by category"
          description="Find exactly what you need across our curated collections."
        />

        <Stagger className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((category) => (
            <StaggerItem key={category.id}>
              <Link
                href={`/products?category=${category.slug}`}
                className="group border-border hover:shadow-foreground/5 focus-visible:ring-ring relative flex aspect-square flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className="absolute -top-6 -right-6 size-20 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-150"
                  style={{ backgroundColor: category.accent, opacity: 0.25 }}
                />
                <span
                  aria-hidden
                  className="size-9 rounded-xl"
                  style={{ backgroundColor: category.accent, opacity: 0.9 }}
                />
                <span className="relative flex items-center justify-between">
                  <span className="text-sm font-semibold">{category.name}</span>
                  <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
