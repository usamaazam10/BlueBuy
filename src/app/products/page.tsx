import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Container } from '@/components/layout/container';
import { ProductsView } from '@/components/product/products-view';
import { absoluteUrl } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Browse the full BlueBuy collection of premium audio, wearables, displays and more.',
  alternates: { canonical: absoluteUrl('/products/') },
};

export default function ProductsPage() {
  return (
    <Container className="py-12 sm:py-16">
      <header className="mb-10 flex max-w-2xl flex-col gap-3">
        <span className="text-brand text-sm font-semibold tracking-wide uppercase">Collection</span>
        <h1 className="text-4xl font-semibold sm:text-5xl">All products</h1>
        <p className="text-muted-foreground text-lg">
          A carefully chosen collection, engineered to fit seamlessly into your everyday.
        </p>
      </header>

      <Suspense fallback={<div className="text-muted-foreground py-16">Loading products…</div>}>
        <ProductsView />
      </Suspense>
    </Container>
  );
}
