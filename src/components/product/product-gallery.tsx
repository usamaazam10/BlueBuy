'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, X, ZoomIn } from 'lucide-react';
import type { StoreImage, StoreProduct } from '@/types/store';
import { optimizeImageUrl } from '@/services/cloudinary';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/lib/utils';
import { ProductImage } from './product-image';

interface ProductGalleryProps {
  product: StoreProduct;
}

/** Optimized Cloudinary URL for an image at a target width, or the raw URL. */
function sized(image: StoreImage | undefined, width: number): string | undefined {
  if (!image) return undefined;
  return image.publicId ? optimizeImageUrl(image.publicId, { width }) : image.url;
}

/**
 * Product gallery with a premium image experience:
 *  - Desktop: cursor-tracking hover zoom on the main image + a fullscreen
 *    lightbox (portal Modal — focus trap, Esc, scroll lock) with arrow keys.
 *  - Mobile: swipe between images (drag), large tap target to open the lightbox.
 *  - Optimized, lazy-loaded Cloudinary URLs; deterministic SVG fallback when a
 *    product has no media. Honors reduced-motion.
 */
export function ProductGallery({ product }: ProductGalleryProps) {
  const images = product.images;
  const [active, setActive] = React.useState(0);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [zooming, setZooming] = React.useState(false);
  const [origin, setOrigin] = React.useState({ x: 50, y: 50 });
  const reduceMotion = useReducedMotion();

  // Gate hover-zoom behind mount so SSR and the first client render agree
  // (a `typeof window` branch during render would cause a hydration mismatch).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const canHover =
    mounted && typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover)').matches;

  const count = images.length;
  const current = images[active];
  const go = React.useCallback(
    (dir: 1 | -1) => setActive((i) => (count ? (i + dir + count) % count : 0)),
    [count]
  );

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!canHover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div
        className="bg-secondary/40 border-border group relative aspect-square overflow-hidden rounded-3xl border"
        onMouseEnter={() => canHover && current?.url && setZooming(true)}
        onMouseLeave={() => setZooming(false)}
        onMouseMove={handleMouseMove}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.url ?? active}
            drag={count > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            initial={reduceMotion ? false : { opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="h-full w-full cursor-zoom-in touch-pan-y"
            onClick={() => setLightboxOpen(true)}
            style={
              zooming && current?.url
                ? { transform: 'scale(1.8)', transformOrigin: `${origin.x}% ${origin.y}%` }
                : undefined
            }
          >
            <ProductImage
              src={sized(current, 1024)}
              alt={current?.alt ?? product.title}
              seed={product.slug}
              accent={product.accent}
              detailed
              className="h-full w-full"
            />
          </motion.div>
        </AnimatePresence>

        {/* Expand hint (desktop) */}
        {current?.url && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Open fullscreen"
            className="text-foreground absolute top-3 right-3 hidden size-9 items-center justify-center rounded-full bg-white/85 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-white sm:flex dark:bg-black/50 dark:hover:bg-black/70"
          >
            <Expand className="size-4" />
          </button>
        )}

        {/* Swipe arrows (all sizes when >1) */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="text-foreground absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 dark:bg-black/50 dark:hover:bg-black/70"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="text-foreground absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 shadow-sm backdrop-blur transition-opacity hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 dark:bg-black/50 dark:hover:bg-black/70"
            >
              <ChevronRight className="size-4" />
            </button>
            {/* Counter */}
            <span className="text-foreground absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2.5 py-1 text-xs font-medium tabular-nums backdrop-blur dark:bg-black/50 dark:text-white">
              {active + 1} / {count}
            </span>
          </>
        )}

        {/* Zoom affordance */}
        {current?.url && canHover && (
          <span className="text-muted-foreground pointer-events-none absolute right-3 bottom-3 hidden items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[11px] backdrop-blur group-hover:hidden sm:flex dark:bg-black/50 dark:text-white/80">
            <ZoomIn className="size-3" /> Hover to zoom
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="flex flex-wrap gap-3" role="tablist" aria-label="Product images">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`View image ${index + 1}`}
              onClick={() => setActive(index)}
              className={cn(
                'bg-secondary/40 focus-visible:ring-ring relative aspect-square w-20 overflow-hidden rounded-xl border-2 transition-colors outline-none focus-visible:ring-2',
                index === active ? 'border-brand' : 'hover:border-border border-transparent'
              )}
            >
              <ProductImage
                src={sized(image, 160)}
                alt={image.alt}
                seed={product.slug}
                accent={product.accent}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen lightbox */}
      <Modal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        title={`${product.title} — image viewer`}
        hideCloseButton
        className="w-full max-w-5xl border-0 bg-transparent shadow-none"
      >
        <Lightbox
          images={images}
          product={product}
          active={active}
          setActive={setActive}
          onClose={() => setLightboxOpen(false)}
          reduceMotion={!!reduceMotion}
        />
      </Modal>
    </div>
  );
}

interface LightboxProps {
  images: StoreImage[];
  product: StoreProduct;
  active: number;
  setActive: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
  reduceMotion: boolean;
}

/** Fullscreen image viewer with keyboard + swipe navigation. */
function Lightbox({ images, product, active, setActive, onClose, reduceMotion }: LightboxProps) {
  const count = images.length;
  const current = images[active];
  const go = React.useCallback(
    (dir: 1 | -1) => setActive((i) => (count ? (i + dir + count) % count : 0)),
    [count, setActive]
  );

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div className="relative flex flex-col gap-4">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close viewer"
        className="absolute -top-2 right-0 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm transition-colors hover:bg-white"
      >
        <X className="size-4" />
      </button>

      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl bg-black/20">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.url ?? active}
            drag={count > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) go(1);
              else if (info.offset.x > 60) go(-1);
            }}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full"
          >
            {current?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- Cloudinary absolute URL; static export
              <img
                src={
                  current.publicId
                    ? optimizeImageUrl(current.publicId, { width: 1600 })
                    : current.url
                }
                alt={current.alt}
                className="h-full w-full object-contain"
              />
            ) : (
              <ProductImage
                src={undefined}
                alt={product.title}
                seed={product.slug}
                accent={product.accent}
                detailed
                className="h-full w-full"
              />
            )}
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute top-1/2 left-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm transition-colors hover:bg-white"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute top-1/2 right-3 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-800 shadow-sm transition-colors hover:bg-white"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white tabular-nums">
              {active + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-label={`View image ${index + 1}`}
              aria-current={index === active}
              onClick={() => setActive(index)}
              className={cn(
                'relative aspect-square w-14 overflow-hidden rounded-lg border-2 transition-colors',
                index === active
                  ? 'border-white'
                  : 'border-transparent opacity-70 hover:opacity-100'
              )}
            >
              <ProductImage
                src={image.publicId ? optimizeImageUrl(image.publicId, { width: 120 }) : image.url}
                alt={image.alt}
                seed={product.slug}
                accent={product.accent}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
