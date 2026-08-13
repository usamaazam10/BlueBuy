import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { ProductsView } from '@/components/product/products-view';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Products',
  description:
    'Browse every product in the BlueBuy catalogue — filter by category or brand, or shop the BlueBuy Collection.',
  alternates: { canonical: absoluteUrl('/products/') },
};

export default function ProductsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 flex max-w-2xl flex-col gap-3">
        <span className="text-brand text-sm font-semibold tracking-wide uppercase">Shop</span>
        <h1 className="text-4xl font-semibold sm:text-5xl">All products</h1>
        <p className="text-muted-foreground text-lg">
          Search the catalogue, or narrow it down by category and brand.
        </p>
      </header>

      <Suspense fallback={<div className="text-muted-foreground py-16">Loading products…</div>}>
        <ProductsView />
      </Suspense>
    </Container>
  );
}
