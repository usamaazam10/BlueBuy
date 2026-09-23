'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { useHomepage } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import type { HeroContent, HeroSlide } from '@/types/cms';

const EASE = [0.16, 1, 0.3, 1] as const;
/** How long each slide stays up before auto-advancing. */
const SLIDE_DURATION_MS = 6500;

/** Normalizes the legacy singular `hero` object into a one-slide array. */
function slidesFor(hero: HeroContent, heroSlides: HeroSlide[]): HeroSlide[] {
  if (heroSlides.length > 0) return heroSlides;
  return [{ id: 'hero', ...hero }];
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const { data: homepage } = useHomepage();
  const slides = slidesFor(homepage!.hero, homepage!.heroSlides);
  const isCarousel = slides.length > 1;

  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const slide = slides[index] ?? slides[0];

  // Auto-advance while there's more than one slide and the visitor hasn't
  // paused it by hovering/focusing the carousel.
  React.useEffect(() => {
    if (!isCarousel || paused) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [isCarousel, paused, slides.length]);

  // Keep the index in range if the admin removes slides while viewing.
  React.useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <section
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* Optional CMS background image, layered behind the geometric default. */}
      <AnimatePresence mode="wait">
        {slide.backgroundImage && (
          <motion.div
            key={slide.id}
            aria-hidden
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)] bg-cover bg-center"
            style={{ backgroundImage: `url(${slide.backgroundImage})` }}
          />
        )}
      </AnimatePresence>
      {/* Geometric background — no stock imagery */}
      <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] opacity-60" />
      <div
        aria-hidden
        className="bg-brand/20 pointer-events-none absolute -top-24 left-1/2 size-[520px] -translate-x-1/2 rounded-full blur-[120px]"
      />

      <Container className="relative py-20 sm:py-28 lg:py-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            variants={reduceMotion ? undefined : container}
            initial={reduceMotion ? false : 'hidden'}
            animate="show"
            exit={reduceMotion ? undefined : { opacity: 0 }}
            className="mx-auto flex max-w-3xl flex-col items-center text-center"
          >
            {slide.eyebrow && (
              <motion.div variants={item}>
                <span className="bg-secondary/70 text-foreground border-border inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur">
                  <Sparkles className="text-brand size-4" />
                  {slide.eyebrow}
                </span>
              </motion.div>
            )}

            <motion.h1
              variants={item}
              className="font-display mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl"
            >
              {slide.title}
            </motion.h1>

            {slide.subtitle && (
              <motion.p
                variants={item}
                className="text-muted-foreground mt-6 max-w-xl text-lg text-pretty sm:text-xl"
              >
                {slide.subtitle}
              </motion.p>
            )}

            <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row">
              {slide.primaryCta.label && (
                <Button asChild variant="brand" size="lg">
                  <Link href={slide.primaryCta.href || '/'}>
                    {slide.primaryCta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
              {slide.secondaryCta.label && (
                <Button asChild variant="outline" size="lg">
                  <Link href={slide.secondaryCta.href || '/'}>{slide.secondaryCta.label}</Link>
                </Button>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>

        {isCarousel && (
          <div className="mt-12 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
              aria-label="Previous slide"
              className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring hidden size-9 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 sm:flex"
            >
              <ArrowLeft className="size-4" />
            </button>

            <div className="flex items-center gap-2" role="tablist" aria-label="Hero slides">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Show slide ${i + 1} of ${slides.length}`}
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
              aria-label="Next slide"
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
