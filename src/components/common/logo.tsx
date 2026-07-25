'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSiteSettings } from '@/hooks/queries';
import { DEFAULT_SITE_SETTINGS } from '@/types/cms';

interface LogoProps {
  className?: string;
  /** Hide the wordmark, showing only the mark (useful on tight layouts). */
  markOnly?: boolean;
  href?: string | null;
}

/**
 * Brand lockup: a geometric "shopping bag / B" mark plus the wordmark.
 *
 * Driven by the `site_settings` CMS — a custom `logoUrl` replaces the whole
 * lockup with an image, otherwise the wordmark renders the configured
 * `storeName`. The default store name keeps its signature two-tone treatment.
 */
export function Logo({ className, markOnly = false, href = '/' }: LogoProps) {
  const { data: settings } = useSiteSettings();
  const storeName = settings?.storeName || DEFAULT_SITE_SETTINGS.storeName;
  const logoUrl = settings?.logoUrl;

  const content = logoUrl ? (
    <span className={cn('inline-flex items-center', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote CMS URL; unoptimized static export */}
      <img src={logoUrl} alt={storeName} className="h-8 w-auto object-contain" />
    </span>
  ) : (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="9" fill="var(--brand)" />
        <path
          d="M11 9.5h6.2a3.8 3.8 0 0 1 1.2 7.4 4.1 4.1 0 0 1-1.6 7.6H11V9.5Z"
          fill="white"
          fillOpacity="0.15"
        />
        <path
          d="M12.8 11.2h4.4a2.6 2.6 0 0 1 0 5.2h-4.4v-5.2Zm0 6.9h4.9a2.7 2.7 0 0 1 0 5.4h-4.9v-5.4Z"
          fill="white"
        />
      </svg>
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
