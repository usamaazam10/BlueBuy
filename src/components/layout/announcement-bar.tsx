'use client';

import * as React from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useActiveBanners } from '@/hooks/queries';

/**
 * Dismissible announcement bar, driven by the `banners` collection. Renders the
 * top active banner (by `sortOrder`); shows nothing when no banner is active —
 * so the storefront chrome is unchanged until an editor publishes one.
 *
 * Dismissal is per-banner and remembered in `sessionStorage`, keyed by the
 * banner id, so re-showing means publishing a new banner.
 */
export function AnnouncementBar() {
  const { items } = useActiveBanners();
  const banner = items[0];
  const [dismissed, setDismissed] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!banner) return;
    setDismissed(sessionStorage.getItem('bluebuy:banner-dismissed'));
  }, [banner]);

  if (!banner || dismissed === banner.id) return null;

  function dismiss() {
    if (!banner) return;
    sessionStorage.setItem('bluebuy:banner-dismissed', banner.id);
    setDismissed(banner.id);
  }

  return (
    <div
      className="text-brand-foreground relative isolate"
      style={{ backgroundColor: banner.background || 'var(--brand)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-10 py-2 text-center text-sm font-medium">
        <p className="text-pretty">
          {banner.message}
          {banner.linkLabel && (
            <Link href={banner.linkHref || '#'} className="ml-2 underline underline-offset-2">
              {banner.linkLabel}
            </Link>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute top-1/2 right-3 flex size-6 -translate-y-1/2 items-center justify-center rounded-full transition-colors hover:bg-black/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
