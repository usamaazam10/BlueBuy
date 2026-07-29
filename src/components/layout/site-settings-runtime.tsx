'use client';

import * as React from 'react';
import { useSiteSettings } from '@/hooks/queries';
import { resolveLogos } from '@/lib/site-logo';

/** Create or update a <link rel> in <head>, returning the element. */
function upsertLink(rel: string, href: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  link.href = href;
}

/**
 * Applies global `site_settings` to the live document: the brand colour (as the
 * `--brand` CSS variable, which every `bg-brand`/`text-brand` token and the SVG
 * logo read from), a secondary accent (`--brand-accent`), and the favicon.
 *
 * Renders nothing. Mounted once near the root so a single settings change
 * re-themes the whole app without touching component code. Because the app is a
 * static export, this runs on the client — the baked defaults render first,
 * then these overrides apply once Firestore responds.
 */
export function SiteSettingsRuntime() {
  const { data: settings } = useSiteSettings();

  React.useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    if (settings.primaryColor) root.style.setProperty('--brand', settings.primaryColor);
    else root.style.removeProperty('--brand');

    if (settings.secondaryColor) root.style.setProperty('--brand-accent', settings.secondaryColor);
    else root.style.removeProperty('--brand-accent');
  }, [settings]);

  // Favicon + apple-touch icon: fall back to the built-in BlueBuy brand assets
  // so the real logo shows in the tab out of the box, overridable via CMS.
  React.useEffect(() => {
    const { favicon, appleTouchIcon } = resolveLogos(settings);
    upsertLink('icon', favicon);
    upsertLink('apple-touch-icon', appleTouchIcon);
  }, [settings]);

  return null;
}
