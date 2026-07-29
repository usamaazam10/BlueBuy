'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSiteSettings } from '@/hooks/queries';
import { DEFAULT_SITE_SETTINGS } from '@/types/cms';
import { BRAND_ASSETS } from '@/constants/site';
import { resolveLogos } from '@/lib/site-logo';

interface LogoProps {
  className?: string;
  /** Hide the wordmark, showing only the mark (useful on tight layouts). */
  markOnly?: boolean;
  /** Which surface — picks the header/footer logo override before `logoUrl`. */
  surface?: 'header' | 'footer';
  href?: string | null;
}

/**
 * Brand lockup: the BlueBuy mark plus the wordmark.
 *
 * Driven by the `site_settings` CMS. A surface-specific logo (`headerLogoUrl` /
 * `footerLogoUrl`) or the general `logoUrl` replaces the whole lockup with an
 * image; otherwise the built-in BlueBuy mark ({@link BRAND_ASSETS.mark}) renders
 * alongside the configured `storeName`. Because branding flows through settings,
 * changing the logo once in Site Settings updates it everywhere.
 */
export function Logo({ className, markOnly = false, surface = 'header', href = '/' }: LogoProps) {
  const { data: settings } = useSiteSettings();
  const storeName = settings?.storeName || DEFAULT_SITE_SETTINGS.storeName;
  const logos = resolveLogos(settings);
  const override = surface === 'footer' ? logos.footerLogo : logos.headerLogo;

  const content = override ? (
    <span className={cn('inline-flex items-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote CMS URL; unoptimized static export */}
      <img src={override} alt={storeName} className="h-9 w-auto object-contain" />
    </span>
  ) : (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- committed brand asset; unoptimized static export */}
      <img
        src={BRAND_ASSETS.mark}
        alt=""
        aria-hidden="true"
        className="size-8 shrink-0 rounded-lg"
        width={32}
        height={32}
      />
      {!markOnly && (
        <span className="text-lg font-semibold tracking-tight">
          {storeName === DEFAULT_SITE_SETTINGS.storeName ? (
            <>
              Blue<span className="text-brand">Buy</span>
            </>
          ) : (
            storeName
          )}
        </span>
      )}
    </span>
  );

  if (href === null) return content;

  return (
    <Link
      href={href}
      aria-label={`${storeName} home`}
      className="focus-visible:ring-ring focus-visible:ring-offset-background rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  );
}
