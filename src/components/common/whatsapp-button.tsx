'use client';

import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { useStoreProducts } from '@/hooks/queries';
import { buildProductMessage, useWhatsApp } from '@/hooks/use-whatsapp';

/** Official WhatsApp brand green — intentionally literal, not a design token. */
const WHATSAPP_GREEN = '#25D366';

/** The WhatsApp glyph. Inlined (lucide has no brand mark) and purely decorative. */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.142 1.595 5.945L0 24l6.305-1.654a11.94 11.94 0 005.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.945a11.87 11.87 0 00-3.45-8.406" />
    </svg>
  );
}

/**
 * Floating WhatsApp support button.
 *
 * Fixed bottom-right on every storefront page (`SiteChrome` skips it under
 * `/admin` and `/login`). The number comes from `site_settings` via
 * {@link useWhatsApp} — the component renders nothing until an admin configures
 * one, so an unconfigured store never shows a dead link.
 *
 * The pre-filled message is context-aware: on a product page it names the
 * product the customer is looking at, so the store receives an actionable
 * enquiry rather than a bare "hello". The product is resolved from the URL slug
 * against the already-cached catalogue, which keeps this self-contained — no
 * context provider and no prop threading through every page.
 *
 * Sits at `z-30`: above page content, but deliberately below the sticky navbar
 * (`z-40`), drawers/modals (`z-50`) and toasts, so it can never trap or obscure
 * a primary flow.
 */
export function WhatsAppButton() {
  const { enabled, buildUrl } = useWhatsApp();
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const { data: products } = useStoreProducts();

  // `/product/<slug>/` → the product's name, when the catalogue has loaded.
  // Anything else (or a slug we can't resolve yet) falls back to the CMS
  // greeting, so the link is always sensible.
  const slug = pathname?.match(/^\/product\/([^/]+)/)?.[1];
  const product = slug ? products.find((candidate) => candidate.slug === slug) : undefined;
  const href = buildUrl(product ? buildProductMessage(product.title) : undefined);

  if (!enabled) return null;

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        product ? `Ask about ${product.title} on WhatsApp` : 'Chat with BlueBuy support on WhatsApp'
      }
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : { type: 'spring', stiffness: 420, damping: 26, delay: 0.4 }
      }
      whileHover={reduceMotion ? undefined : { scale: 1.06 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      className="focus-visible:ring-ring focus-visible:ring-offset-background fixed right-4 bottom-4 z-30 flex size-14 items-center justify-center rounded-full text-white shadow-lg shadow-black/15 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:right-6 sm:bottom-6"
      style={{ backgroundColor: WHATSAPP_GREEN }}
    >
      <WhatsAppGlyph className="size-7" />
    </motion.a>
  );
}
