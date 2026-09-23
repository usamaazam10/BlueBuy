'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductImage } from '@/components/product/product-image';
import { AddToCartButton } from '@/components/product/add-to-cart-button';
import { useStoreProducts, useHomepage } from '@/hooks/queries';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';
import type { StoreProduct } from '@/types/store';

const EASE = [0.16, 1, 0.3, 1] as const;
/** How long each slide stays up before auto-advancing. */
const SLIDE_DURATION_MS = 6000;
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
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };

  // No products at all (a brand-new, unstocked store) — fall back to the
  // plain text hero band instead of an empty product carousel.
  if (!product) {
    const hero = homepage!.hero;
    return (
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] opacity-60" />
        <div
          aria-hidden
          className="bg-brand/20 pointer-events-none absolute -top-24 left-1/2 size-[520px] -translate-x-1/2 rounded-full blur-[120px]"
        />
        <Container className="relative py-20 sm:py-28 lg:py-32">
          <motion.div
            variants={reduceMotion ? undefined : container}
            initial={reduceMotion ? false : 'hidden'}
            animate="show"
            className="mx-auto flex max-w-3xl flex-col items-center text-center"
          >
            {hero.eyebrow && (
              <motion.div variants={item}>
                <span className="bg-secondary/70 text-foreground border-border inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur">
                  <Sparkles className="text-brand size-4" />
                  {hero.eyebrow}
                </span>
              </motion.div>
            )}
            <motion.h1
              variants={item}
              className="font-display mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
            >
              {hero.title}
            </motion.h1>
            {hero.subtitle && (
              <motion.p
                variants={item}
                className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty sm:text-xl"
              >
                {hero.subtitle}
              </motion.p>
            )}
            <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row">
              {hero.primaryCta.label && (
                <Button asChild variant="brand" size="lg">
                  <Link href={hero.primaryCta.href || '/'}>
                    {hero.primaryCta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
              {hero.secondaryCta.label && (
                <Button asChild variant="outline" size="lg">
                  <Link href={hero.secondaryCta.href || '/'}>{hero.secondaryCta.label}</Link>
                </Button>
              )}
            </motion.div>
          </motion.div>
        </Container>
      </section>
    );
  }

  const href = `/product/${product.slug}`;

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] opacity-60" />
      <div
        aria-hidden
        className="bg-brand/20 pointer-events-none absolute -top-24 left-1/2 size-[520px] -translate-x-1/2 rounded-full blur-[120px]"
      />

      <Container className="relative py-14 sm:py-20 lg:py-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={product.id}
            variants={reduceMotion ? undefined : container}
            initial={reduceMotion ? false : 'hidden'}
            animate="show"
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            {/* Text column */}
            <div className="flex flex-col items-start text-left">
              <motion.div variants={item}>
                <span className="bg-secondary/70 text-foreground border-border inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur">
                  <Sparkles className="text-brand size-4" />
                  {product.badge ?? 'Featured'}
                </span>
              </motion.div>

              <motion.h1
                variants={item}
                className="font-display mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
              >
                <Link href={href} className="hover:text-brand transition-colors">
                  {product.title}
                </Link>
              </motion.h1>

              {product.shortDescription && (
                <motion.p
                  variants={item}
                  className="text-muted-foreground mt-5 max-w-lg text-lg text-pretty"
                >
                  {product.shortDescription}
                </motion.p>
              )}

              <motion.div variants={item} className="mt-6 flex items-baseline gap-3">
                <span className="text-3xl font-semibold">{formatPrice(product.price)}</span>
                {product.compareAtPrice && (
                  <span className="text-muted-foreground text-lg line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
              </motion.div>

              <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row">
                <AddToCartButton
                  product={product}
                  outOfStock={product.stock <= 0}
                  openDrawerOnAdd
                  size="lg"
                />
                <Button asChild variant="outline" size="lg">
                  <Link href="/products">Browse all products</Link>
                </Button>
              </motion.div>
            </div>

            {/* Product image */}
            <motion.div variants={item} className="mx-auto w-full max-w-sm lg:max-w-none">
              <Link
                href={href}
                className="group focus-visible:ring-ring block outline-none focus-visible:ring-2"
              >
                <div className="bg-card border-border shadow-foreground/5 relative aspect-square overflow-hidden rounded-3xl border shadow-xl">
                  <ProductImage
                    src={product.thumbnail}
                    alt={product.title}
                    seed={product.slug}
                    accent={product.accent}
                    detailed
                    className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                  {product.badge && (
                    <Badge
                      variant={BADGE_VARIANT[product.badge]}
                      className="absolute top-4 left-4 shadow-sm"
                    >
                      {product.badge}
                    </Badge>
                  )}
                </div>
              </Link>
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {isCarousel && (
          <div className="mt-10 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              aria-label="Previous product"
              className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring hidden size-9 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 sm:flex"
            >
              <ArrowLeft className="size-4" />
            </button>

            <div className="flex items-center gap-2" role="tablist" aria-label="Featured products">
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
                    i === index ? 'bg-brand w-6' : 'bg-border hover:bg-muted-foreground w-1.5'
                  )}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % slides.length)}
              aria-label="Next product"
              className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring hidden size-9 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 sm:flex"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </Container>
    </section>
  );
}
