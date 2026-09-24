'use client';

import * as React from 'react';
import { Zap } from 'lucide-react';
import { useStoreProducts } from '@/hooks/queries';
import { pickDeals } from '@/lib/product-deals';
import { Container } from '@/components/layout/container';
import { ShelfHeader } from '@/components/common/shelf-header';
import { ProductShelf } from '@/components/product/product-shelf';
import { Reveal } from '@/components/common/motion';

/**
 * "Today's best deals" — every in-stock product currently on sale, biggest
 * saving first, on a tinted band so it stands out. Renders nothing when no
 * product is discounted, so it never advertises deals that don't exist.
 */
export function DealsShelf() {
  const { data } = useStoreProducts();
  const deals = React.useMemo(() => pickDeals(data, 10), [data]);

  if (deals.length === 0) return null;

  return (
    <section className="py-6 sm:py-8">
      <Container>
        <Reveal>
          <div className="bg-brand-muted/60 border-brand/10 rounded-3xl border p-5 sm:p-7">
            <ShelfHeader
              icon={
                <span className="bg-brand text-brand-foreground flex size-8 items-center justify-center rounded-lg">
                  <Zap className="size-[18px]" aria-hidden />
                </span>
              }
              title="Today’s best deals"
              description="Our biggest savings right now — while stock lasts."
              href="/products"
              className="mb-5"
            />
            {/* One swipeable row on phones; wraps to rows of five on desktop. */}
            <ProductShelf products={deals} />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
