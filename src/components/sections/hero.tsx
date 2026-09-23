'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductImage } from '@/components/product/product-image';
import { useStoreProducts, useHomepage } from '@/hooks/queries';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';
import type { StoreProduct } from '@/types/store';

const EASE = [0.16, 1, 0.3, 1] as const;
/** How long each slide stays up before auto-advancing. */
const SLIDE_DURATION_MS = 5000;
/** How many products the carousel shows at most. */
const MAX_SLIDES = 5;

const BADGE_VARIANT = {
  Sale: 'sale',
  New: 'new',
  Featured: 'featured',
  Limited: 'limited',
} as const;

/**
 * Products to showcase, in order: the admin's curated `heroProductIds` when
 * set, otherwise `featured`-flagged products backfilled with the rest — so the
 * carousel always shows real, shoppable products rather than an empty banner.
 */
function resolveSlides(products: readonly StoreProduct[], heroProductIds: string[]) {
  if (heroProductIds.length > 0) {
    const byId = new Map(products.map((product) => [product.id, product]));
    const picked = heroProductIds
      .map((id) => byId.get(id))
      .filter((product): product is StoreProduct => product != null);
    if (picked.length > 0) return picked.slice(0, MAX_SLIDES);
  }
  const featured = products.filter((product) => product.featured);
  const rest = products.filter((product) => !product.featured);
  return [...featured, ...rest].slice(0, MAX_SLIDES);
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { data: products } = useStoreProducts();
  const { data: homepage } = useHomepage();
  const { formatPrice } = useCurrency();

  const slides = React.useMemo(
    () => resolveSlides(products, homepage!.heroProductIds),
    [products, homepage]
  );
  const isCarousel = slides.length > 1;

  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const product = slides[index] ?? slides[0];

  // Auto-advance while there's more than one product and the visitor hasn't
  // paused it by hovering/focusing the carousel.
  React.useEffect(() => {
    if (!isCarousel || paused) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [isCarousel, paused, slides.length]);

  // Keep the index in range if the catalogue/curation shrinks while viewing.
  React.useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  };
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  };

  // No products at all (a brand-new, unstocked store) — fall back to the
  // plain text hero band instead of an empty product carousel.
  if (!product) {
    const hero = homepage!.hero;
    return (
      <section className="py-8 sm:py-10">
        <Container>
          <div className="border-border bg-secondary/20 relative overflow-hidden rounded-3xl border px-6 py-10 text-center sm:px-10 sm:py-14">
            {hero.eyebrow && (
              <span className="bg-background/70 text-foreground border-border mx-auto inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium backdrop-blur">
                <Sparkles className="text-brand size-4" />
                {hero.eyebrow}
              </span>
            )}
            <h1 className="font-display mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {hero.title}
            </h1>
            {hero.subtitle && (
              <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-pretty">
                {hero.subtitle}
              </p>
            )}
            {hero.primaryCta.label && (
              <Button asChild variant="brand" className="mt-6">
                <Link href={hero.primaryCta.href || '/'}>
                  {hero.primaryCta.label} <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
        </Container>
      </section>
    );
  }

  const href = `/product/${product.slug}`;

  return (
    <section className="py-6 sm:py-8">
      <Container>
        <div
          className="border-border bg-secondary/20 relative overflow-hidden rounded-3xl border p-6 sm:p-8 lg:p-10"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={product.id}
              variants={reduceMotion ? undefined : container}
              initial={reduceMotion ? false : 'hidden'}
              animate="show"
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto] sm:gap-8"
            >
              {/* Text */}
              <div className="flex flex-col items-start gap-3 text-left">
                <motion.span
                  variants={item}
                  className="bg-background/80 text-foreground border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
                >
                  <Sparkles className="text-brand size-3.5" />
                  {product.badge ?? 'Featured'}
                </motion.span>

                <motion.h1 variants={item}>
                  <Link
                    href={href}
                    className="font-display hover:text-brand line-clamp-2 text-xl font-semibold tracking-tight text-balance transition-colors sm:text-2xl lg:text-3xl"
                  >
                    {product.title}
                  </Link>
                </motion.h1>

                {product.shortDescription && (
                  <motion.p
                    variants={item}
                    className="text-muted-foreground hidden max-w-md text-sm text-pretty sm:line-clamp-2 md:block"
                  >
                    {product.shortDescription}
                  </motion.p>
                )}

                <motion.div variants={item} className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold sm:text-xl">
                    {formatPrice(product.price)}
                  </span>
                  {product.compareAtPrice && (
                    <span className="text-muted-foreground text-sm line-through">
                      {formatPrice(product.compareAtPrice)}
                    </span>
                  )}
                </motion.div>

                <motion.div variants={item}>
                  <Button asChild variant="brand" size="sm">
                    <Link href={href}>
                      Shop now <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </motion.div>
              </div>

              {/* Product image, contained — not a full-bleed background, so it
                  never fights with any text printed on the photo itself. */}
              <motion.div variants={item} className="mx-auto shrink-0">
                <Link
                  href={href}
                  className="group focus-visible:ring-ring relative block size-32 outline-none focus-visible:ring-2 sm:size-40 lg:size-48"
                >
                  <div className="bg-card border-border relative h-full w-full overflow-hidden rounded-2xl border">
                    <ProductImage
                      src={product.thumbnail}
                      alt={product.title}
                      seed={product.slug}
                      accent={product.accent}
                      className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  </div>
                  {product.badge && (
                    <Badge
                      variant={BADGE_VARIANT[product.badge]}
                      className="absolute top-2 left-2 shadow-sm"
                    >
                      {product.badge}
                    </Badge>
                  )}
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {isCarousel && (
            <div className="mt-6 flex items-center justify-center gap-4 sm:justify-start">
              <button
                type="button"
                onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
                aria-label="Previous product"
                className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring hidden size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 sm:flex"
              >
                <ArrowLeft className="size-4" />
              </button>

              <div
                className="flex items-center gap-1.5"
                role="tablist"
                aria-label="Featured products"
              >
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Show ${s.title}`}
                    onClick={() => setIndex(i)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      i === index ? 'bg-brand w-5' : 'bg-border hover:bg-muted-foreground w-1.5'
                    )}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % slides.length)}
                aria-label="Next product"
                className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-ring hidden size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 sm:flex"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
