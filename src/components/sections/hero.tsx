'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ProductMedia } from '@/components/product/product-media';
import { getFeaturedProducts } from '@/data/products';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  const reduceMotion = useReducedMotion();
  const floatProducts = getFeaturedProducts(3);

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
          <motion.div variants={item}>
            <span className="bg-secondary/70 text-foreground border-border inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur">
              <Sparkles className="text-brand size-4" />
              New season, new arrivals
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
          >
            Premium tech,
            <br />
            <span className="text-brand">beautifully</span> simple.
          </motion.h1>

          <motion.p
            variants={item}
            className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty sm:text-xl"
          >
            BlueBuy brings together thoughtfully designed audio, wearables and displays — the
            essentials, refined. Free shipping, 30-day returns.
          </motion.p>

          <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="brand" size="lg">
              <Link href="/products">
                Shop the collection <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/about">Our story</Link>
            </Button>
          </motion.div>
        </motion.div>

        {/* Floating product tiles */}
        <div aria-hidden className="pointer-events-none mt-16 hidden justify-center gap-6 lg:flex">
          {floatProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={reduceMotion ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.5 + i * 0.12 }}
              className="bg-card border-border shadow-foreground/5 w-64 overflow-hidden rounded-3xl border shadow-xl"
              style={{ transform: `translateY(${i === 1 ? '-24px' : '0'})` }}
            >
              <ProductMedia
                seed={product.images[0]}
                accent={product.accent}
                className="aspect-[4/5] w-full"
              />
            </motion.div>
          ))}
        </div>
      </Container>
    </section>
  );
}
