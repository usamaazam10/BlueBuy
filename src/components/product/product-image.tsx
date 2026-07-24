import { cn } from '@/lib/utils';
import { ProductMedia } from './product-media';

interface ProductImageProps {
  /** Real (Cloudinary) image URL. When absent, the SVG placeholder is used. */
  src?: string;
  alt: string;
  /** Deterministic seed + accent for the placeholder fallback. */
  seed: string;
  accent: string;
  /** Larger, more detailed placeholder composition (details gallery). */
  detailed?: boolean;
  className?: string;
}

/**
 * Renders a product's real image (lazy-loaded) when one exists, and otherwise
 * falls back to the deterministic `ProductMedia` SVG art — so products without
 * uploaded media still look intentional. Images are loaded natively lazily;
 * Next.js image optimisation is off (static export), so a plain `<img>` is the
 * correct primitive and Cloudinary already serves absolute, optimised URLs.
 */
export function ProductImage({ src, alt, seed, accent, detailed, className }: ProductImageProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- images.unoptimized is on (static export); Cloudinary serves absolute URLs.
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn('h-full w-full object-cover', className)}
      />
    );
  }
  return <ProductMedia seed={seed} accent={accent} detailed={detailed} className={className} />;
}
