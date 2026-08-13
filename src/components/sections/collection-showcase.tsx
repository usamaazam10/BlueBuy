'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Package } from 'lucide-react';
import { useStoreProducts } from '@/hooks/queries';
import { BLUEBUY_COLLECTION, isCollectionProduct } from '@/lib/collection';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/common/motion';

/**
 * The BlueBuy Collection band — introduces BlueBuy's own product line and sends
 * shoppers to the products page filtered to it (see `@/lib/collection`).
 *
 * Deliberately *not* another product grid: the featured grid directly above
 * already shows these products in a catalogue where most items are own-label,
 * so a second grid would repeat the same cards. This band explains what the
 * line is and links to the full, filtered listing instead.
 *
 * Renders nothing when the catalogue has no own-label products, so the section
 * can never advertise an empty product line.
 */
export function CollectionShowcase() {
  const { data, isLoading } = useStoreProducts();

  const count = React.useMemo(() => data.filter(isCollectionProduct).length, [data]);

  if (isLoading || count === 0) return null;

  const href = `/products?brand=${BLUEBUY_COLLECTION.slug}`;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <Reveal>
          <div className="border-border bg-secondary/30 grid grid-cols-1 items-center gap-8 rounded-3xl border p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
            <div className="flex flex-col items-start gap-4">
              <span className="bg-brand/10 text-brand flex size-12 items-center justify-center rounded-xl">
                <Package className="size-6" aria-hidden />
              </span>
              <h2 className="text-3xl font-semibold text-balance sm:text-4xl">
                {BLUEBUY_COLLECTION.name}
              </h2>
              <p className="text-muted-foreground max-w-xl text-pretty">
                {BLUEBUY_COLLECTION.description}
              </p>
              <Button asChild variant="brand">
                <Link href={href}>
                  Shop the collection <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <Link
              href={href}
              className="border-border bg-card hover:border-foreground/15 focus-visible:ring-ring flex flex-col gap-1 rounded-2xl border p-6 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{count}</span>
              <span className="text-muted-foreground text-sm">
                {count === 1 ? 'product in the collection' : 'products in the collection'}
              </span>
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
