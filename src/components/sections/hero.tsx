'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/components/product/product-image';
import { useStoreProducts, useHomepage } from '@/hooks/queries';
import { deriveAccent } from '@/lib/mappers/store';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Purely decorative, abstract tiles used before catalogue data arrives (or when
 * the store has no products yet). These are NOT fake products — they render the
 * geometric `ProductMedia` art from neutral seeds, so nothing implies a listing
 * that doesn't exist.
 */
const DECORATIVE_TILES = ['tile-a', 'tile-b', 'tile-c'].map((seed) => ({
  key: seed,
  src: undefined as string | undefined,
  accent: deriveAccent(seed),
  seed,
}));

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { data } = useStoreProducts();
  const { data: homepage } = useHomepage();
  const hero = homepage!.hero;

  // Purely decorative tiles; fall back to placeholder art before data loads.
  const tiles =
    data.length > 0
      ? data.slice(0, 3).map((product) => ({
          key: product.id,
          src: product.thumbnail || undefined,
          accent: product.accent,
          seed: product.slug,
        }))
      : DECORATIVE_TILES;

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <section className="relative overflow-hidden">
      {/* Optional CMS background image, layered behind the geometric default. */}
      {hero.backgroundImage && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${hero.backgroundImage})` }}
        />
      )}
      {/* Geometric background — no stock imagery */}
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
            className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
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

        {/* Floating product tiles */}
        <div aria-hidden className="pointer-events-none mt-16 hidden justify-center gap-6 lg:flex">
          {tiles.map((tile, i) => (
            <motion.div
              key={tile.key}
              initial={reduceMotion ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.5 + i * 0.12 }}
              className="bg-card border-border shadow-foreground/5 w-64 overflow-hidden rounded-3xl border shadow-xl"
              style={{ transform: `translateY(${i === 1 ? '-24px' : '0'})` }}
            >
              <ProductImage
                src={tile.src}
                alt=""
                seed={tile.seed}
                accent={tile.accent}
                className="aspect-[4/5] w-full"
              />
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
