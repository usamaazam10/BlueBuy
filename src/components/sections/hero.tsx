'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles } from 'lucide-react';
import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/components/product/product-image';
import { AddToCartButton } from '@/components/product/add-to-cart-button';
import { useStoreProducts, useHomepage } from '@/hooks/queries';
import { useCurrency } from '@/hooks/use-currency';
import { discountPercent, pickCurated, pickDeals } from '@/lib/product-deals';
import { cn } from '@/lib/utils';
import type { HeroBanner } from '@/types/cms';
import type { StoreProduct } from '@/types/store';

const EASE = [0.16, 1, 0.3, 1] as const;
/** How long each slide stays up before auto-advancing. */
const SLIDE_DURATION_MS = 5000;
/** How many slides the carousel shows at most. */
const MAX_SLIDES = 5;
/** Horizontal drag distance (px) that counts as a swipe. */
const SWIPE_PX = 60;

type Slide =
  | { kind: 'banner'; id: string; banner: HeroBanner }
  | { kind: 'product'; id: string; product: StoreProduct };

/** Shared height of the carousel and the side panel, so the row stays even. */
const HERO_HEIGHT = 'h-[16.5rem] sm:h-[21rem] lg:h-[26rem]';

/**
 * Cycles `0…count-1` every {@link SLIDE_DURATION_MS} unless `paused`, keeping
 * the index in range if `count` shrinks. Returns the index, the last move's
 * direction (for the slide animation) and a `go(delta)` stepper.
 */
function useAutoCycle(count: number, paused: boolean) {
  const [[index, direction], setState] = React.useState<[number, number]>([0, 1]);

  const go = React.useCallback(
    (delta: number) => setState(([i]) => [(i + delta + count) % count, delta >= 0 ? 1 : -1]),
    [count]
  );

  React.useEffect(() => {
    if (count < 2 || paused) return;
    // Skip ticks while the tab is hidden: animation frames are suspended
    // there, so queued slide transitions would pile up.
    const timer = window.setInterval(() => {
      if (!document.hidden) go(1);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [count, paused, go, index]);

  React.useEffect(() => {
    if (count > 0 && index >= count) setState([0, 1]);
  }, [index, count]);

  return { index: count > 0 ? index % count : 0, direction, go, setState };
}

/** An admin-uploaded photo slide: the image fills the frame; copy is optional. */
function BannerSlide({ banner }: { banner: HeroBanner }) {
  const hasCopy = Boolean(banner.title);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote CMS URL; unoptimized static export */}
      <img
        src={banner.image}
        alt={banner.title || 'Featured promotion'}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
      {hasCopy && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent"
          />
          <div className="relative flex h-full max-w-xl flex-col justify-center gap-3 p-6 text-white sm:gap-4 sm:p-10 lg:p-14">
            <h2 className="font-display line-clamp-3 text-2xl leading-tight font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl">
              {banner.title}
            </h2>
            {banner.subtitle && (
              <p className="line-clamp-2 max-w-md text-sm text-white/85 sm:text-base">
                {banner.subtitle}
              </p>
            )}
            {banner.ctaLabel && (
              <span className="text-brand-deep mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold shadow-lg transition-transform group-hover:translate-x-0.5">
                {banner.ctaLabel} <ArrowRight className="size-4" />
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

/**
 * A product slide, used when no photo slides are uploaded: deep brand ground,
 * copy on the left and the product photo framed on the right — framed rather
 * than full-bleed, so marketing text printed on product photos never clashes.
 */
function ProductSlide({ product }: { product: StoreProduct }) {
  const { formatPrice } = useCurrency();
  const pct = discountPercent(product);

  return (
    <div className="bg-brand-deep relative flex h-full items-center gap-4 overflow-hidden p-5 pb-11 text-white sm:gap-8 sm:p-10 lg:p-14">
      {/* Soft brand glows for depth. */}
      <span
        aria-hidden
        className="bg-brand absolute -top-24 -right-10 size-80 rounded-full opacity-50 blur-3xl"
      />
      <span
        aria-hidden
        className="bg-brand absolute -bottom-32 left-1/4 size-72 rounded-full opacity-25 blur-3xl"
      />

      <div className="relative flex min-w-0 flex-1 flex-col items-start gap-2.5 sm:gap-4">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
          <Sparkles className="size-3.5" aria-hidden />
          {pct ? `Save ${pct}%` : (product.badge ?? 'Featured pick')}
        </span>
        <h2 className="font-display line-clamp-2 text-lg leading-tight font-bold tracking-tight text-balance sm:text-3xl lg:text-[2.25rem]">
          {product.title}
        </h2>
        {product.shortDescription && (
          <p className="hidden max-w-md text-sm text-white/75 sm:line-clamp-2 sm:text-base">
            {product.shortDescription}
          </p>
        )}
        <div className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-xl font-bold sm:text-3xl">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-white/60 line-through sm:text-base">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
        <span className="text-brand-deep mt-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow-lg transition-transform group-hover:translate-x-0.5 sm:px-5 sm:py-2.5">
          Shop now <ArrowRight className="size-4" />
        </span>
      </div>

      <div className="relative aspect-square h-[70%] shrink-0 overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/30 sm:h-[82%]">
        <ProductImage
          src={product.thumbnail}
          alt=""
          seed={product.slug}
          accent={product.accent}
          className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
    </div>
  );
}

/** The main auto-rotating slideshow (photo banners or product slides). */
function HeroCarousel({ slides }: { slides: Slide[] }) {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = React.useState(false);
  const { index, direction, go, setState } = useAutoCycle(slides.length, paused);
  const dragged = React.useRef(false);
  const slide = slides[index];
  const isCarousel = slides.length > 1;

  const variants = {
    enter: (dir: number) => (reduceMotion ? { opacity: 0 } : { x: dir > 0 ? '100%' : '-100%' }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => (reduceMotion ? { opacity: 0 } : { x: dir > 0 ? '-100%' : '100%' }),
  };

  const href =
    slide.kind === 'banner' ? slide.banner.href || '/products' : `/product/${slide.product.slug}`;
  const label =
    slide.kind === 'banner'
      ? slide.banner.title || slide.banner.ctaLabel || 'View promotion'
      : `Shop ${slide.product.title}`;

  return (
    <div
      className={cn(
        'group/carousel bg-muted relative overflow-hidden rounded-3xl shadow-sm',
        HERO_HEIGHT
      )}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={slide.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0.3 : 0.7, ease: EASE }}
          drag={isCarousel ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragStart={() => {
            dragged.current = true;
          }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_PX) go(1);
            else if (info.offset.x > SWIPE_PX) go(-1);
            // Let the click that ends a drag fall through harmlessly.
            window.setTimeout(() => (dragged.current = false), 0);
          }}
          className="absolute inset-0"
        >
          <Link
            href={href}
            aria-label={label}
            draggable={false}
            onClickCapture={(e) => {
              if (dragged.current) e.preventDefault();
            }}
            className="group focus-visible:ring-ring block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            {slide.kind === 'banner' ? (
              <BannerSlide banner={slide.banner} />
            ) : (
              <ProductSlide product={slide.product} />
            )}
          </Link>
        </motion.div>
      </AnimatePresence>

      {isCarousel && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="text-brand-deep focus-visible:ring-ring absolute top-1/2 left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-md transition-opacity outline-none group-hover/carousel:opacity-100 hover:bg-white focus-visible:opacity-100 focus-visible:ring-2 sm:flex"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next slide"
            className="text-brand-deep focus-visible:ring-ring absolute top-1/2 right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-md transition-opacity outline-none group-hover/carousel:opacity-100 hover:bg-white focus-visible:opacity-100 focus-visible:ring-2 sm:flex"
          >
            <ChevronRight className="size-5" />
          </button>

          <div
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1.5 backdrop-blur sm:bottom-4"
            role="tablist"
            aria-label="Choose slide"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slide ${i + 1} of ${slides.length}`}
                onClick={() => setState([i, i >= index ? 1 : -1])}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Side panel (desktop): the store's biggest current savings, one at a time,
 * rotating on its own — the "top deals" column of a marketplace homepage.
 */
function TopDealsPanel({ products }: { products: StoreProduct[] }) {
  const [paused, setPaused] = React.useState(false);
  const { index, go } = useAutoCycle(products.length, paused);
  const { formatPrice } = useCurrency();
  const reduceMotion = useReducedMotion();
  const product = products[index];
  const pct = discountPercent(product);
  const href = `/product/${product.slug}`;

  return (
    <aside
      className={cn(
        'border-border bg-card hidden flex-col overflow-hidden rounded-3xl border shadow-sm lg:flex',
        HERO_HEIGHT
      )}
      aria-label="Top deals"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="font-display flex items-center gap-2 text-base font-bold tracking-tight">
          <Flame className="text-destructive size-[18px]" aria-hidden />
          Top deals
        </h2>
        {products.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous deal"
              className="hover:bg-secondary text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next deal"
              className="hover:bg-secondary text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-full transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={product.id}
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-5"
        >
          <Link
            href={href}
            tabIndex={-1}
            className="group bg-secondary/50 relative min-h-0 flex-1 overflow-hidden rounded-2xl"
          >
            <ProductImage
              src={product.thumbnail}
              alt={product.title}
              seed={product.slug}
              accent={product.accent}
              className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
            />
            {pct && (
              <span className="bg-destructive text-destructive-foreground absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm">
                -{pct}%
              </span>
            )}
          </Link>
          <div className="flex flex-col gap-1">
            <Link
              href={href}
              className="hover:text-brand line-clamp-2 text-sm leading-snug font-semibold transition-colors"
            >
              {product.title}
            </Link>
            <div className="flex items-baseline gap-2">
              <span className="text-brand text-lg font-bold">{formatPrice(product.price)}</span>
              {product.compareAtPrice && (
                <span className="text-muted-foreground text-xs line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>
          </div>
          <AddToCartButton
            product={product}
            outOfStock={product.stock <= 0}
            variant="brand"
            size="sm"
            className="w-full"
          />
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

/**
 * Homepage hero, marketplace style: a large auto-rotating slideshow of the
 * admin's uploaded photo banners (Admin → CMS → Homepage → Hero slides) — or,
 * when none are uploaded, of curated products — beside a rotating "Top deals"
 * panel on desktop.
 */
export function Hero() {
  const { data: products, isLoading } = useStoreProducts();
  const { data: homepage } = useHomepage();

  const slides = React.useMemo<Slide[]>(() => {
    const banners = (homepage.heroBanners ?? []).filter((banner) => banner.image);
    if (banners.length > 0) {
      return banners
        .slice(0, MAX_SLIDES)
        .map((banner) => ({ kind: 'banner', id: banner.id, banner }));
    }
    return pickCurated(products, homepage.heroProductIds, MAX_SLIDES).map((product) => ({
      kind: 'product',
      id: product.id,
      product,
    }));
  }, [products, homepage]);

  // Deals first; fall back to curated picks for a catalogue with no sales on.
  const sideProducts = React.useMemo(() => {
    const deals = pickDeals(products, 6);
    return deals.length > 0 ? deals : pickCurated(products, homepage.heroProductIds, 6);
  }, [products, homepage.heroProductIds]);

  // Still fetching the catalogue — hold the hero's footprint instead of
  // flashing the text fallback.
  if (slides.length === 0 && isLoading) {
    return (
      <section className="pt-5 pb-2 sm:pt-6">
        <Container>
          <div
            className={cn('bg-muted/60 animate-pulse rounded-3xl', HERO_HEIGHT)}
            aria-hidden="true"
          />
        </Container>
      </section>
    );
  }

  // No products and no banners at all (a brand-new, unstocked store) — the
  // plain text hero band.
  if (slides.length === 0) {
    const hero = homepage.hero;
    return (
      <section className="pt-5 pb-2 sm:pt-6">
        <Container>
          <div className="bg-brand-deep relative overflow-hidden rounded-3xl px-6 py-14 text-center text-white sm:px-10 sm:py-20">
            <span
              aria-hidden
              className="bg-brand absolute -top-24 -right-10 size-80 rounded-full opacity-50 blur-3xl"
            />
            <div className="relative">
              {hero.eyebrow && (
                <span className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium backdrop-blur">
                  <Sparkles className="size-4" />
                  {hero.eyebrow}
                </span>
              )}
              <h1 className="font-display mt-5 text-3xl font-bold tracking-tight text-balance sm:text-5xl">
                {hero.title}
              </h1>
              {hero.subtitle && (
                <p className="mx-auto mt-4 max-w-xl text-pretty text-white/80">{hero.subtitle}</p>
              )}
              {hero.primaryCta.label && (
                <Button asChild className="text-brand-deep mt-7 bg-white hover:bg-white/90">
                  <Link href={hero.primaryCta.href || '/'}>
                    {hero.primaryCta.label} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className="pt-5 pb-2 sm:pt-6">
      {/* The storefront's single h1, for SEO and screen readers. */}
      <h1 className="sr-only">{homepage.hero.title}</h1>
      <Container>
        <div
          className={cn(
            'grid grid-cols-1 gap-4',
            sideProducts.length > 0 &&
              'lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]'
          )}
        >
          <HeroCarousel slides={slides} />
          {sideProducts.length > 0 && <TopDealsPanel products={sideProducts} />}
        </div>
      </Container>
    </section>
  );
}
